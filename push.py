import httpx
from config import settings


async def send_push(token: str, db_pool):
    """
    Send an Expo push notification. Fire-and-forget.
    Never includes message content, sender name, or message type.
    If DeviceNotRegistered, clear the push_token from the database.
    Wrapped in try/except — never raises.
    """
    if not token:
        return

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                settings.EXPO_PUSH_URL,
                json={
                    "to": token,
                    "title": "Only Us 💬",
                    "body": "You have a new message",
                    "sound": "default",
                    "data": {},
                },
                headers={"Content-Type": "application/json"},
            )

            result = response.json()

            # Handle DeviceNotRegistered error
            if isinstance(result, dict) and "data" in result:
                for item in result.get("data", []):
                    if isinstance(item, dict):
                        details = item.get("details", {})
                        if isinstance(details, dict) and details.get("error") == "DeviceNotRegistered":
                            async with db_pool.acquire() as conn:
                                await conn.execute(
                                    "UPDATE users SET push_token = NULL WHERE push_token = $1",
                                    token,
                                )
                            break
    except Exception as e:
        print(f"[Push] Error sending push notification: {e}")
