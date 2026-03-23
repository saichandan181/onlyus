# 💕 Only Us — Backend

Private couples chat backend with end-to-end encryption support. The server is a **blind relay** — it never stores, reads, or logs message content. All chat data is encrypted on-device using TweetNaCl before transmission.

## Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI |
| Real-time | python-socketio (AsyncServer) |
| Database | PostgreSQL (asyncpg) |
| Cache | Redis (redis-py async) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Push | Expo Push (httpx) |
| Server | Uvicorn (ASGI) |

## Architecture

Single unified ASGI application:
- **FastAPI** handles all REST endpoints
- **python-socketio** handles all real-time events
- Both mounted together via `socketio.ASGIApp`
- One `uvicorn` process runs everything
- One PostgreSQL connection pool shared across both
- One Redis connection shared across both

---

## Prerequisites

- Python 3.11+
- PostgreSQL 14+ (local or via PgAdmin 4)
- Redis 7+

## Local Setup

### 1. Clone & enter directory

```bash
cd onlyus-backend
```

### 2. Create virtual environment

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 5. Create PostgreSQL database

```sql
CREATE DATABASE "onlyus-anti";
```

### 6. Run the server

```bash
python main.py
```

The server will:
- Connect to PostgreSQL and create the connection pool
- Run migrations (create tables automatically)
- Connect to Redis
- Start listening on `http://0.0.0.0:8000`

---

## Docker Setup

### Build

```bash
docker build -t onlyus-backend .
```

### Run

```bash
docker run -d \
  --name onlyus-backend \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://postgres:password@host.docker.internal:5432/onlyus-anti \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e JWT_SECRET=your_long_random_secret_key_minimum_32_chars \
  onlyus-backend
```

---

## REST API Reference

### Auth

| Method | Endpoint | Auth | Request Body | Response | Description |
|--------|----------|------|-------------|----------|-------------|
| POST | `/auth/register` | ✅ | `{name, email, password, public_key?}` | `AuthResponse` | Register new user |
| POST | `/auth/login` | ✅ | `{email, password}` | `AuthResponse` | Login |
| GET | `/auth/me` | ✅ | — | `UserResponse` | Get current user |
| PATCH | `/auth/me` | ✅ | `{name?, avatar?}` | `UserResponse` | Update profile |
| POST | `/auth/logout` | ✅ | — | `{success}` | Logout (clear online + push token) |

### Pair

| Method | Endpoint | Auth | Request Body | Response | Description |
|--------|----------|------|-------------|----------|-------------|
| POST | `/pair/generate` | ✅ | — | `{code, expires_at}` | Generate 6-digit pairing code |
| POST | `/pair/join` | ✅ | `{code}` | `{pair_id, partner}` | Join a pair |
| GET | `/pair/status` | ✅ | — | `PairStatusResponse` | Get pair status |
| GET | `/pair/partner` | ✅ | — | `PartnerResponse` | Get partner profile |
| PATCH | `/pair/anniversary` | ✅ | `{anniversary_date}` | `{success, anniversary_date}` | Set anniversary |
| DELETE | `/pair/unpair` | ✅ | — | `{success}` | Unpair + clean Redis |

### Users

| Method | Endpoint | Auth | Request Body | Response | Description |
|--------|----------|------|-------------|----------|-------------|
| GET | `/users/search?q=` | ✅ | — | `[UserResponse]` | Search users (min 2 chars) |
| PATCH | `/users/push-token` | ✅ | `{push_token}` | `{success}` | Update push token |
| PATCH | `/users/public-key` | ✅ | `{public_key}` | `{success}` | Update public key |

### Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

### Response Models

**UserResponse**
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "avatar": "string|null",
  "public_key": "string|null",
  "is_online": false,
  "created_at": "datetime"
}
```

**AuthResponse**
```json
{
  "user": UserResponse,
  "token": "jwt_string"
}
```

**PairStatusResponse**
```json
{
  "paired": true,
  "pair_id": "uuid|null",
  "partner": PartnerResponse|null,
  "anniversary_date": "date|null"
}
```

---

## Socket.IO Event Reference

### Connection

Connect with token via query string:
```
ws://localhost:8000/socket.io/?token=<jwt_token>
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `msg:text` | `{id, encrypted_payload, time}` | Send encrypted text message |
| `msg:delete` | `{msgId, time}` | Delete a message |
| `msg:react` | `{msgId, emoji, time}` | React to a message |
| `media:start` | `{transferId, totalChunks, type, mimeType, fileName?, duration?, caption?, time}` | Start media transfer |
| `media:chunk` | `{transferId, index, data}` | Send media chunk |
| `media:done` | `{transferId}` | Complete media transfer |
| `media:request` | `{transferId}` | Request media re-send |
| `typing:start` | `{}` | Started typing |
| `typing:stop` | `{}` | Stopped typing |
| `mood:update` | `{mood}` | Update mood status |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `msg:new` | `{id, encrypted_payload, time, sender}` | New message received |
| `msg:deleted` | `{msgId, time}` | Message deleted |
| `msg:reaction` | `{msgId, emoji, time}` | Reaction received |
| `media:incoming` | `{transferId, totalChunks, type, mimeType, ...sender}` | Media transfer starting |
| `media:chunk` | `{transferId, index, data}` | Media chunk received |
| `media:complete` | `{transferId, sender}` | Media transfer complete |
| `media:progress` | `{transferId, progress}` | Upload progress (%) |
| `media:pending` | `[{transferId, type, mimeType, ...}]` | Pending media on connect |
| `media:resend_request` | `{transferId}` | Partner requests re-send |
| `media:unavailable` | `{transferId, reason}` | Media not available |
| `partner:online` | `{name, avatar}` | Partner came online |
| `partner:offline` | `{}` | Partner went offline |
| `partner:status` | `{online}` | Partner status on connect |
| `typing:start` | `{}` | Partner started typing |
| `typing:stop` | `{}` | Partner stopped typing |
| `mood:update` | `{mood}` | Partner mood changed |
| `error` | `{error, message?}` | Error notification |

---

## Redis Key Reference

| Key Pattern | Type | TTL | Description |
|------------|------|-----|-------------|
| `offline_queue:{userId}` | List | 7 days (604800s) | Queued events for offline user |
| `pending_media:{userId}:{transferId}` | String (JSON) | 24 hours (86400s) | Pending media metadata |

---

## Error Codes

| HTTP Code | When |
|-----------|------|
| 400 | Validation error, expired code, self-pair, already paired |
| 401 | Bad credentials, invalid/expired token |
| 404 | User/pair not found |
| 409 | Email exists, already paired |
| 500 | Database/Redis errors |

---

## Security

- **Blind relay**: Server never stores, reads, or logs message content
- **E2E encryption**: All messages encrypted on-device before transmission
- **JWT auth**: 30-day expiry, enforced on every endpoint and socket connection
- **Bcrypt passwords**: Passwords hashed with bcrypt, never returned in any response
- **Push tokens hidden**: Push tokens never in any API response
- **Auto-cleanup**: Pairing codes expire after 10 minutes, offline queues after 7 days
- **Error isolation**: Every socket handler wrapped in try/except
