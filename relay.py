"""
relay.py — Complete Socket.IO relay for Only Us.
Blind relay: never stores messages, only forwards encrypted payloads.
Offline queuing via Redis with 7-day TTL.
"""

import asyncio
import json
from urllib.parse import parse_qs

import socketio
from fastapi import HTTPException

from auth import decode_token
import database
import redis_client
from push import send_push

# ─── Socket.IO Server ─────────────────────────────────────

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    max_http_buffer_size=300 * 1024,
)

# In-memory chunk tracking for media transfers
chunk_tracker: dict = {}


# ─── Helper Functions ──────────────────────────────────────

async def verify_socket_token(token: str):
    """Decode JWT and query the user from PostgreSQL. Returns user dict or None."""
    try:
        print(f"[Relay] Verifying token: {token[:20]}...")
        payload = decode_token(token)
        print(f"[Relay] Token payload: {payload}")
        user_id = payload.get("sub")
        if not user_id:
            print("[Relay] No user_id in token payload")
            return None

        async with database.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, name, email, avatar, public_key, push_token, is_online "
                "FROM users WHERE id = $1",
                user_id,
            )
        if row:
            user = dict(row)
            # Convert UUID to string for JSON serialization
            user["id"] = str(user["id"])
            print(f"[Relay] User found: {user['name']}")
            return user
        print(f"[Relay] No user found with id: {user_id}")
        return None
    except HTTPException as e:
        print(f"[Relay] Token verification HTTPException: {e.status_code} - {e.detail}")
        return None
    except Exception as e:
        print(f"[Relay] Token verification error: {type(e).__name__}: {e}")
        return None


async def get_pair_id(user_id: str):
    """Get the pair ID for a user. Returns pair_id string or None."""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM pairs WHERE user_a = $1 OR user_b = $1", user_id
        )
    if row:
        pair_id = str(row["id"])
        print(f"[Relay] get_pair_id: user_id={user_id}, pair_id={pair_id}")
        return pair_id
    print(f"[Relay] get_pair_id: user_id={user_id}, NO PAIR FOUND")
    return None


async def get_partner(pair_id: str, my_user_id: str):
    """Get the partner's info given a pair_id and the current user's id."""
    async with database.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT u.id, u.push_token, u.is_online, u.name, u.avatar "
            "FROM pairs p "
            "JOIN users u ON u.id = CASE "
            "  WHEN p.user_a = $1 THEN p.user_b ELSE p.user_a END "
            "WHERE p.id = $2",
            my_user_id,
            pair_id,
        )
    if row:
        partner = dict(row)
        partner["id"] = str(partner["id"])
        return partner
    return None


async def is_partner_in_room(pair_id: str, my_sid: str) -> bool:
    """Check if the partner is connected in the same room."""
    try:
        # Get all sockets in the room
        room_sids = sio.manager.rooms.get("/", {}).get(pair_id, set())
        count = len(room_sids)
        partner_found = any(sid != my_sid for sid in room_sids)
        
        print(f"[Relay] is_partner_in_room: pair_id={pair_id}, my_sid={my_sid}, total_participants={count}, partner_found={partner_found}, room_sids={room_sids}")
        return partner_found
    except Exception as e:
        print(f"[Relay] is_partner_in_room error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def flush_offline_queue(sid: str, user_id: str):
    """Flush all queued offline events to the reconnected user."""
    try:
        key = f"offline_queue:{user_id}"
        items = await redis_client.redis.lrange(key, 0, -1)
        await redis_client.redis.delete(key)

        for item in items:
            event = json.loads(item)
            event_type = event.get("type")
            if event_type == "message":
                await sio.emit("msg:new", event, to=sid)
            elif event_type == "delete":
                await sio.emit("msg:deleted", event, to=sid)
            elif event_type == "reaction":
                await sio.emit("msg:reaction", event, to=sid)
    except Exception as e:
        print(f"[Relay] Error flushing offline queue: {e}")


async def flush_pending_media(sid: str, user_id: str):
    """Notify the user of any pending media transfers."""
    try:
        pending = []
        cursor = 0
        while True:
            cursor, keys = await redis_client.redis.scan(
                cursor=cursor, match=f"pending_media:{user_id}:*", count=100
            )
            for key in keys:
                value = await redis_client.redis.get(key)
                if value:
                    pending.append(json.loads(value))
            if cursor == 0:
                break

        if pending:
            await sio.emit("media:pending", pending, to=sid)
        # Do NOT delete keys yet — deleted on media:done or media:request
    except Exception as e:
        print(f"[Relay] Error flushing pending media: {e}")


async def queue_event(partner_id: str, event: dict):
    """Push an event to the partner's offline queue in Redis (7-day TTL)."""
    try:
        key = f"offline_queue:{partner_id}"
        await redis_client.redis.rpush(key, json.dumps(event))
        await redis_client.redis.expire(key, 604800)  # 7 days
    except Exception as e:
        print(f"[Relay] Error queuing event: {e}")


# ─── Socket.IO Event Handlers ─────────────────────────────


@sio.event
async def connect(sid, environ, auth=None):
    """Authenticate user, join pair room, sync status."""
    try:
        # Extract token from query string
        query_string = environ.get("QUERY_STRING", "")
        print(f"[Relay] Query string: {query_string[:100]}...")
        params = parse_qs(query_string)
        token = params.get("token", [None])[0]
        print(f"[Relay] Token from query: {token[:20] if token else 'None'}...")

        if not token:
            # Also try auth dict (socket.io client auth option)
            if auth and isinstance(auth, dict):
                token = auth.get("token")
                print(f"[Relay] Token from auth: {token[:20] if token else 'None'}...")

        if not token:
            print("[Relay] No token provided")
            raise ConnectionRefusedError("Unauthorized: no token provided")

        user = await verify_socket_token(token)
        if not user:
            print("[Relay] Token verification failed")
            raise ConnectionRefusedError("Unauthorized: invalid token")

        print(f"[Relay] User authenticated: id={user['id']}, name={user['name']}")

        pair_id = await get_pair_id(user["id"])
        if not pair_id:
            await sio.emit("error", {"error": "not_paired"}, to=sid)
            raise ConnectionRefusedError("Not paired")

        # Save session
        await sio.save_session(sid, {"user": user, "pair_id": pair_id})

        # Join the pair room (MUST BE AWAITED)
        await sio.enter_room(sid, pair_id)
        print(f"[Relay] User {user['name']} (sid={sid}) joined room {pair_id}")

        # Set user online
        async with database.pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET is_online = true WHERE id = $1", user["id"]
            )

        # Notify the connecting user of partner's status
        partner_online = await is_partner_in_room(pair_id, sid)
        print(f"[Relay] Partner online check for {user['name']}: {partner_online}")
        await sio.emit("partner:status", {"online": partner_online}, to=sid)

        # Notify partner that this user came online
        await sio.emit(
            "partner:online",
            {"name": user.get("name"), "avatar": user.get("avatar")},
            room=pair_id,
            skip_sid=sid,
        )
        print(f"[Relay] Emitted partner:online to room {pair_id} (skip_sid={sid})")

        # Flush queued messages and pending media
        await flush_offline_queue(sid, user["id"])
        await flush_pending_media(sid, user["id"])

        print(f"[Relay] User {user['name']} connected (sid={sid}, pair_id={pair_id})")
        
        # Debug: List all rooms for this socket
        rooms = sio.rooms(sid)
        print(f"[Relay] Socket {sid} is in rooms: {rooms}")
    except ConnectionRefusedError:
        raise
    except Exception as e:
        print(f"[Relay] Connect error: {e}")
        raise ConnectionRefusedError(f"Server error: {e}")


@sio.event
async def disconnect(sid):
    """Set user offline and notify partner."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return

        user = session["user"]
        pair_id = session["pair_id"]

        # Set user offline
        async with database.pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET is_online = false WHERE id = $1", user["id"]
            )

        # Notify partner
        await sio.emit("partner:offline", {}, room=pair_id, skip_sid=sid)

        print(f"[Relay] User {user['name']} disconnected (sid={sid})")
    except Exception as e:
        print(f"[Relay] Disconnect error: {e}")


# ─── Message Events ───────────────────────────────────────


@sio.on("msg:text")
async def msg_text(sid, data):
    """Relay an encrypted text message to the partner."""
    try:
        session = await sio.get_session(sid)
        if not session:
            print(f"[Relay] msg:text - No session for sid={sid}")
            return
        user = session["user"]
        pair_id = session["pair_id"]
        print(f"[Relay] msg:text from {user['name']} (sid={sid}, pair_id={pair_id})")
        
        partner = await get_partner(pair_id, user["id"])

        if not partner:
            print(f"[Relay] msg:text - No partner found for pair_id={pair_id}")
            return

        payload = {
            "id": data["id"],
            "encrypted_payload": data["encrypted_payload"],
            "time": data["time"],
            "sender": {"id": user["id"], "name": user["name"]},
        }

        partner_connected = await is_partner_in_room(pair_id, sid)
        print(f"[Relay] msg:text - partner_connected={partner_connected}")
        
        if partner_connected:
            print(f"[Relay] Emitting msg:new to room {pair_id} (skip_sid={sid})")
            await sio.emit("msg:new", payload, room=pair_id, skip_sid=sid)
        else:
            print(f"[Relay] Queuing message for offline partner {partner['id']}")
            await queue_event(
                partner["id"],
                {
                    "type": "message",
                    "id": data["id"],
                    "encrypted_payload": data["encrypted_payload"],
                    "time": data["time"],
                },
            )
            asyncio.create_task(send_push(partner.get("push_token"), database.pool))
    except Exception as e:
        print(f"[Relay] msg:text error: {e}")
        import traceback
        traceback.print_exc()
        await sio.emit("error", {"error": "relay_error", "message": str(e)}, to=sid)


@sio.on("msg:delete")
async def msg_delete(sid, data):
    """Relay a message deletion to the partner."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        user = session["user"]
        pair_id = session["pair_id"]
        partner = await get_partner(pair_id, user["id"])

        if not partner:
            return

        delete_payload = {"msgId": data["msgId"], "time": data["time"]}

        partner_connected = await is_partner_in_room(pair_id, sid)
        if partner_connected:
            await sio.emit("msg:deleted", delete_payload, room=pair_id, skip_sid=sid)
        else:
            await queue_event(
                partner["id"],
                {
                    "type": "delete",
                    "msgId": data["msgId"],
                    "time": data["time"],
                },
            )
    except Exception as e:
        print(f"[Relay] msg:delete error: {e}")
        await sio.emit("error", {"error": "relay_error", "message": str(e)}, to=sid)


@sio.on("msg:react")
async def msg_react(sid, data):
    """Relay a message reaction to the partner."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        user = session["user"]
        pair_id = session["pair_id"]
        partner = await get_partner(pair_id, user["id"])

        if not partner:
            return

        reaction_payload = {
            "msgId": data["msgId"],
            "emoji": data["emoji"],
            "time": data["time"],
        }

        partner_connected = await is_partner_in_room(pair_id, sid)
        if partner_connected:
            await sio.emit("msg:reaction", reaction_payload, room=pair_id, skip_sid=sid)
        else:
            await queue_event(
                partner["id"],
                {
                    "type": "reaction",
                    "msgId": data["msgId"],
                    "emoji": data["emoji"],
                    "time": data["time"],
                },
            )
    except Exception as e:
        print(f"[Relay] msg:react error: {e}")
        await sio.emit("error", {"error": "relay_error", "message": str(e)}, to=sid)


# ─── Media Events ──────────────────────────────────────────


@sio.on("media:start")
async def media_start(sid, data):
    """Start a media transfer — forward or register as pending."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        user = session["user"]
        pair_id = session["pair_id"]
        partner = await get_partner(pair_id, user["id"])

        if not partner:
            return

        transfer_id = data["transferId"]
        chunk_tracker[transfer_id] = {
            "total": data["totalChunks"],
            "received": 0,
        }

        incoming_payload = {
            "transferId": transfer_id,
            "totalChunks": data["totalChunks"],
            "type": data["type"],
            "mimeType": data["mimeType"],
            "fileName": data.get("fileName"),
            "duration": data.get("duration"),
            "caption": data.get("caption"),
            "sender": {"id": user["id"], "name": user["name"]},
        }

        partner_connected = await is_partner_in_room(pair_id, sid)
        if partner_connected:
            await sio.emit(
                "media:incoming", incoming_payload, room=pair_id, skip_sid=sid
            )
        else:
            metadata = {
                "transferId": transfer_id,
                "type": data["type"],
                "mimeType": data["mimeType"],
                "fileName": data.get("fileName"),
                "duration": data.get("duration"),
                "caption": data.get("caption"),
                "senderUserId": user["id"],
                "senderName": user["name"],
                "sentAt": data.get("time"),
            }
            await redis_client.redis.set(
                f"pending_media:{partner['id']}:{transfer_id}",
                json.dumps(metadata),
                ex=86400,  # 24 hours
            )
            asyncio.create_task(send_push(partner.get("push_token"), database.pool))
    except Exception as e:
        print(f"[Relay] media:start error: {e}")
        await sio.emit("error", {"error": "relay_error", "message": str(e)}, to=sid)


@sio.on("media:chunk")
async def media_chunk(sid, data):
    """Forward a media chunk IMMEDIATELY — never store."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        pair_id = session["pair_id"]
        transfer_id = data["transferId"]

        # Forward chunk immediately
        await sio.emit(
            "media:chunk",
            {
                "transferId": transfer_id,
                "index": data["index"],
                "data": data["data"],
            },
            room=pair_id,
            skip_sid=sid,
        )

        # Update chunk tracker and emit progress to sender
        if transfer_id in chunk_tracker:
            chunk_tracker[transfer_id]["received"] += 1
            received = chunk_tracker[transfer_id]["received"]
            total = chunk_tracker[transfer_id]["total"]
            progress = round((received / total) * 100)
            await sio.emit(
                "media:progress",
                {"transferId": transfer_id, "progress": progress},
                to=sid,
            )
    except Exception as e:
        print(f"[Relay] media:chunk error: {e}")


@sio.on("media:done")
async def media_done(sid, data):
    """Complete a media transfer — notify partner, clean up."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        user = session["user"]
        pair_id = session["pair_id"]
        partner = await get_partner(pair_id, user["id"])

        if not partner:
            return

        transfer_id = data["transferId"]

        await sio.emit(
            "media:complete",
            {
                "transferId": transfer_id,
                "sender": {"id": user["id"], "name": user["name"]},
            },
            room=pair_id,
            skip_sid=sid,
        )

        # Clean up
        await redis_client.redis.delete(f"pending_media:{partner['id']}:{transfer_id}")
        chunk_tracker.pop(transfer_id, None)
    except Exception as e:
        print(f"[Relay] media:done error: {e}")


@sio.on("media:request")
async def media_request(sid, data):
    """Request a media re-send from the partner."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        pair_id = session["pair_id"]
        user = session["user"]
        transfer_id = data["transferId"]
        partner = await get_partner(pair_id, user["id"])

        if not partner:
            return

        partner_connected = await is_partner_in_room(pair_id, sid)
        if partner_connected:
            await sio.emit(
                "media:resend_request",
                {"transferId": transfer_id},
                room=pair_id,
                skip_sid=sid,
            )
        else:
            await sio.emit(
                "media:unavailable",
                {"transferId": transfer_id, "reason": "sender_offline"},
                to=sid,
            )
            await redis_client.redis.delete(f"pending_media:{user['id']}:{transfer_id}")
    except Exception as e:
        print(f"[Relay] media:request error: {e}")


# ─── Utility Events ───────────────────────────────────────


@sio.on("typing:start")
async def typing_start(sid, data):
    """Relay typing start indicator."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        await sio.emit("typing:start", {}, room=session["pair_id"], skip_sid=sid)
    except Exception as e:
        print(f"[Relay] typing:start error: {e}")


@sio.on("typing:stop")
async def typing_stop(sid, data):
    """Relay typing stop indicator."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        await sio.emit("typing:stop", {}, room=session["pair_id"], skip_sid=sid)
    except Exception as e:
        print(f"[Relay] typing:stop error: {e}")


@sio.on("mood:update")
async def mood_update(sid, data):
    """Relay mood update to partner."""
    try:
        session = await sio.get_session(sid)
        if not session:
            return
        await sio.emit(
            "mood:update",
            {"mood": data["mood"]},
            room=session["pair_id"],
            skip_sid=sid,
        )
    except Exception as e:
        print(f"[Relay] mood:update error: {e}")


@sio.on("debug:rooms")
async def debug_rooms(sid, data):
    """Debug: Show room membership."""
    try:
        session = await sio.get_session(sid)
        if not session:
            await sio.emit("debug:response", {"error": "No session"}, to=sid)
            return
        
        user = session["user"]
        pair_id = session["pair_id"]
        rooms = sio.rooms(sid)
        
        # Count participants in pair room
        participants = []
        try:
            room_sids = sio.manager.rooms.get("/", {}).get(pair_id, set())
            for participant_sid in room_sids:
                participant_session = await sio.get_session(participant_sid)
                if participant_session:
                    participants.append({
                        "sid": participant_sid,
                        "name": participant_session["user"]["name"]
                    })
                else:
                    participants.append({
                        "sid": participant_sid,
                        "name": "Unknown (no session)"
                    })
        except Exception as e:
            participants = [{"error": str(e)}]
            import traceback
            traceback.print_exc()
        
        response = {
            "your_sid": sid,
            "your_name": user["name"],
            "pair_id": pair_id,
            "your_rooms": list(rooms),
            "participants_in_pair_room": participants
        }
        
        print(f"[Relay] Debug rooms: {response}")
        await sio.emit("debug:response", response, to=sid)
    except Exception as e:
        print(f"[Relay] debug:rooms error: {e}")
        import traceback
        traceback.print_exc()
        await sio.emit("debug:response", {"error": str(e)}, to=sid)
