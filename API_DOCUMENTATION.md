# Only Us - API Documentation

## Base URL
```
http://localhost:8000
```

## Table of Contents
- [Authentication](#authentication)
- [User Management](#user-management)
- [Pairing](#pairing)
- [Mood & anniversary (E2E — Socket.IO only, no REST)](#5-mood--anniversary-e2e--socketio-only-no-rest)
- [Socket.IO Events](#socketio-events)
- [REST vs realtime summary](#rest-vs-realtime-summary)

---

## Authentication

### 1. Register
Create a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "public_key": "optional-public-key-for-e2e-encryption"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": null,
    "public_key": "optional-public-key-for-e2e-encryption",
    "is_online": false,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `409 Conflict` - Email already registered
- `422 Unprocessable Entity` - Invalid input data

---

### 2. Login
Authenticate and get a JWT token.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": null,
    "public_key": "optional-public-key-for-e2e-encryption",
    "is_online": false,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `401 Unauthorized` - Invalid email or password

---

### 3. Get Current User
Get the authenticated user's profile.

**Endpoint:** `GET /auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "avatar": null,
  "public_key": "optional-public-key-for-e2e-encryption",
  "is_online": false,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `401 Unauthorized` - Invalid or missing token

---

### 4. Update Profile
Update the authenticated user's name and/or avatar.

**Endpoint:** `PATCH /auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "John Smith",
  "avatar": "https://example.com/avatar.jpg"
}
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Smith",
  "email": "john@example.com",
  "avatar": "https://example.com/avatar.jpg",
  "public_key": "optional-public-key-for-e2e-encryption",
  "is_online": false,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `400 Bad Request` - No fields to update
- `401 Unauthorized` - Invalid or missing token

---

### 5. Logout
Log out and set user offline.

**Endpoint:** `POST /auth/logout`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## User Management

### 1. Search Users
Search for users by name or email.

**Endpoint:** `GET /users/search?q=<query>`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `q` (required) - Search query (minimum 2 characters)

**Response:** `200 OK`
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "avatar": null,
    "public_key": "jane-public-key",
    "is_online": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

**Errors:**
- `422 Unprocessable Entity` - Query too short (< 2 characters)

---

### 2. Update Push Token
Update the user's Expo push notification token.

**Endpoint:** `PATCH /users/push-token`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### 3. Update Public Key
Update the user's public key for E2E encryption.

**Endpoint:** `PATCH /users/public-key`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "public_key": "new-public-key-string"
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## Pairing

### 1. Generate Pairing Code
Generate a 6-digit pairing code.

**Endpoint:** `POST /pair/generate`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "code": "123456",
  "expires_at": "2024-01-15T11:30:00Z"
}
```

**Errors:**
- `400 Bad Request` - Already paired

---

### 2. Join Pair
Join a pair using a 6-digit code.

**Endpoint:** `POST /pair/join`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "pair_id": "650e8400-e29b-41d4-a716-446655440000",
  "partner": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Jane Doe",
    "avatar": null,
    "public_key": "jane-public-key",
    "is_online": true
  }
}
```

**Errors:**
- `400 Bad Request` - Invalid or expired code, or cannot pair with yourself
- `409 Conflict` - One of you is already paired

---

### 3. Get Pair Status
Get the current pairing status.

**Endpoint:** `GET /pair/status`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`

**When paired:** Pair metadata only. Anniversary and mood are **not** returned here; they are relayed over Socket.IO and stored on each device (see below).

```json
{
  "paired": true,
  "pair_id": "650e8400-e29b-41d4-a716-446655440000",
  "partner": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Jane Doe",
    "avatar": null,
    "public_key": "jane-public-key",
    "is_online": true
  }
}
```

**When not paired:**
```json
{
  "paired": false,
  "pair_id": null,
  "partner": null
}
```

---

### 4. Get Partner Info
Get the partner's profile.

**Endpoint:** `GET /pair/partner`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Jane Doe",
  "avatar": null,
  "public_key": "jane-public-key",
  "is_online": true
}
```

**Errors:**
- `404 Not Found` - Not paired

---

### 5. Mood & anniversary (E2E — Socket.IO only, no REST)

There are **no HTTP endpoints** for mood or anniversary. The FastAPI server does **not** persist them in PostgreSQL. Behavior:

| Concern | Mood | Anniversary |
|--------|------|----------------|
| **REST** | None | None |
| **Realtime** | Socket.IO event `mood:update` | Socket.IO event `anniversary:update` |
| **Server** | Blind relay to partner’s socket, or Redis offline queue (`type: "mood"`) | Same (`type: "anniversary"`) |
| **Your device** | Store *your* mood key locally (e.g. SecureStore) | Store ISO date locally (e.g. `YYYY-MM-DD`) |
| **Partner’s device** | Receive ciphertext → decrypt → show *partner* mood | Receive ciphertext → decrypt → same shared date |

Both use the **same wire shape** as encrypted chat: `encrypted_payload` (IV + hex ciphertext from the pair shared secret) and `time` (ISO-8601).

#### Plaintext before encryption (client-only)

These JSON strings are encrypted with the pair shared secret (same scheme as `msg:text`), then sent as `encrypted_payload`.

**Mood** — keys must match your app’s mood catalog (e.g. theme keys like `happy`, `calm`):

```json
{ "v": 1, "kind": "mood", "mood": "happy" }
```

**Anniversary** — ISO calendar date:

```json
{ "v": 1, "kind": "anniversary", "iso": "2024-06-15" }
```

#### Emit (client → server)

```javascript
socket.emit('mood:update', {
  encrypted_payload: '<iv:hex ciphertext>',
  time: '2024-01-15T10:30:00Z'
});

socket.emit('anniversary:update', {
  encrypted_payload: '<iv:hex ciphertext>',
  time: '2024-01-15T10:30:00Z'
});
```

#### Receive (server → client)

Listen for `mood:update` and `anniversary:update` with the same `{ encrypted_payload, time }` object. Decrypt locally; do not expect any REST resource to mirror these values.

---

### 6. Unpair
Unpair and clean up all data.

**Endpoint:** `DELETE /pair/unpair`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Errors:**
- `404 Not Found` - Not paired

---

## Socket.IO Events

### Connection

**URL:** `ws://localhost:8000/socket.io/`

**Authentication:**
```javascript
const socket = io('http://localhost:8000', {
  query: { token: 'your-jwt-token' },
  auth: { token: 'your-jwt-token' }
});
```

---

### Client → Server Events

#### 1. msg:text
Send a text message to partner.

**Emit:**
```javascript
socket.emit('msg:text', {
  id: 'msg-1234567890',
  encrypted_payload: 'encrypted message content',
  time: '2024-01-15T10:30:00Z'
});
```

---

#### 2. msg:delete
Delete a message.

**Emit:**
```javascript
socket.emit('msg:delete', {
  msgId: 'msg-1234567890',
  time: '2024-01-15T10:30:00Z'
});
```

---

#### 3. msg:react
React to a message with an emoji.

**Emit:**
```javascript
socket.emit('msg:react', {
  msgId: 'msg-1234567890',
  emoji: '❤️',
  time: '2024-01-15T10:30:00Z'
});
```

---

#### 4. typing:start
Notify partner that you're typing.

**Emit:**
```javascript
socket.emit('typing:start', {});
```

---

#### 5. typing:stop
Notify partner that you stopped typing.

**Emit:**
```javascript
socket.emit('typing:stop', {});
```

---

#### 6. mood:update
Relay **encrypted** mood to partner (blind relay — same pattern as `msg:text`). Encrypt on device, then emit.

**Emit:**
```javascript
socket.emit('mood:update', {
  encrypted_payload: 'iv:hex…',
  time: '2024-01-15T10:30:00Z'
});
```

---

#### 7. anniversary:update
Relay **encrypted** shared anniversary date to partner (same wire shape as `mood:update`). Not stored in the database.

**Emit:**
```javascript
socket.emit('anniversary:update', {
  encrypted_payload: 'iv:hex…',
  time: '2024-01-15T10:30:00Z'
});
```

---

#### 8. media:start
Start a media transfer.

**Emit:**
```javascript
socket.emit('media:start', {
  transferId: 'transfer-1234567890',
  totalChunks: 100,
  type: 'image',  // 'image', 'video', 'audio', 'file'
  mimeType: 'image/jpeg',
  fileName: 'photo.jpg',
  duration: 30,  // optional, for audio/video
  caption: 'Check this out!',  // optional
  time: '2024-01-15T10:30:00Z'
});
```

---

#### 9. media:chunk
Send a chunk of media data.

**Emit:**
```javascript
socket.emit('media:chunk', {
  transferId: 'transfer-1234567890',
  index: 0,
  data: 'base64-encoded-chunk-data'
});
```

---

#### 10. media:done
Complete a media transfer.

**Emit:**
```javascript
socket.emit('media:done', {
  transferId: 'transfer-1234567890',
  time: '2024-01-15T10:30:00Z'
});
```

---

#### 11. media:request
Request a media re-send from partner.

**Emit:**
```javascript
socket.emit('media:request', {
  transferId: 'transfer-1234567890'
});
```

---

#### 12. debug:rooms
Debug: Get room membership info.

**Emit:**
```javascript
socket.emit('debug:rooms', {});
```

---

### Server → Client Events

#### 1. connect
Connection established.

**Receive:**
```javascript
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

---

#### 2. disconnect
Connection closed.

**Receive:**
```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

---

#### 3. error
Server error occurred.

**Receive:**
```javascript
socket.on('error', (data) => {
  // data: { error: 'not_paired' } or { error: 'relay_error', message: '...' }
});
```

---

#### 4. partner:status
Partner's online status on connection.

**Receive:**
```javascript
socket.on('partner:status', (data) => {
  // data: { online: true }
});
```

---

#### 5. partner:online
Partner came online.

**Receive:**
```javascript
socket.on('partner:online', (data) => {
  // data: { name: 'Jane Doe', avatar: 'https://...' }
});
```

---

#### 6. partner:offline
Partner went offline.

**Receive:**
```javascript
socket.on('partner:offline', (data) => {
  // data: {}
});
```

---

#### 7. msg:new
New message received.

**Receive:**
```javascript
socket.on('msg:new', (data) => {
  // data: {
  //   id: 'msg-1234567890',
  //   encrypted_payload: 'encrypted message content',
  //   time: '2024-01-15T10:30:00Z',
  //   sender: { id: '...', name: 'Jane Doe' }
  // }
});
```

---

#### 8. msg:deleted
Message was deleted.

**Receive:**
```javascript
socket.on('msg:deleted', (data) => {
  // data: { msgId: 'msg-1234567890', time: '2024-01-15T10:30:00Z' }
});
```

---

#### 9. msg:reaction
Message reaction received.

**Receive:**
```javascript
socket.on('msg:reaction', (data) => {
  // data: { msgId: 'msg-1234567890', emoji: '❤️', time: '2024-01-15T10:30:00Z' }
});
```

---

#### 10. typing:start
Partner started typing.

**Receive:**
```javascript
socket.on('typing:start', (data) => {
  // data: {}
});
```

---

#### 11. typing:stop
Partner stopped typing.

**Receive:**
```javascript
socket.on('typing:stop', (data) => {
  // data: {}
});
```

---

#### 12. mood:update
Partner's mood updated (opaque ciphertext).

**Receive:**
```javascript
socket.on('mood:update', (data) => {
  // data: { encrypted_payload: 'iv:hex…', time: '...' }
  // Decrypt locally with shared secret.
});
```

---

#### 13. anniversary:update
Partner's shared anniversary ciphertext (opaque). Decrypt and persist locally; not loaded from REST.

**Receive:**
```javascript
socket.on('anniversary:update', (data) => {
  // data: { encrypted_payload: 'iv:hex…', time: '...' }
});
```

---

#### 14. media:incoming
Incoming media transfer notification.

**Receive:**
```javascript
socket.on('media:incoming', (data) => {
  // data: {
  //   transferId: 'transfer-1234567890',
  //   totalChunks: 100,
  //   type: 'image',
  //   mimeType: 'image/jpeg',
  //   fileName: 'photo.jpg',
  //   duration: 30,
  //   caption: 'Check this out!',
  //   sender: { id: '...', name: 'Jane Doe' }
  // }
});
```

---

#### 15. media:chunk
Media chunk received.

**Receive:**
```javascript
socket.on('media:chunk', (data) => {
  // data: {
  //   transferId: 'transfer-1234567890',
  //   index: 0,
  //   data: 'base64-encoded-chunk-data'
  // }
});
```

---

#### 16. media:complete
Media transfer completed.

**Receive:**
```javascript
socket.on('media:complete', (data) => {
  // data: {
  //   transferId: 'transfer-1234567890',
  //   sender: { id: '...', name: 'Jane Doe' }
  // }
});
```

---

#### 17. media:progress
Upload progress update (sender only).

**Receive:**
```javascript
socket.on('media:progress', (data) => {
  // data: { transferId: 'transfer-1234567890', progress: 50 }
});
```

---

#### 18. media:pending
Pending media transfers notification.

**Receive:**
```javascript
socket.on('media:pending', (data) => {
  // data: [
  //   {
  //     transferId: 'transfer-1234567890',
  //     type: 'image',
  //     mimeType: 'image/jpeg',
  //     fileName: 'photo.jpg',
  //     caption: 'Check this out!',
  //     senderUserId: '...',
  //     senderName: 'Jane Doe',
  //     sentAt: '2024-01-15T10:30:00Z'
  //   }
  // ]
});
```

---

#### 19. media:resend_request
Partner requesting media re-send.

**Receive:**
```javascript
socket.on('media:resend_request', (data) => {
  // data: { transferId: 'transfer-1234567890' }
});
```

---

#### 20. media:unavailable
Requested media is unavailable.

**Receive:**
```javascript
socket.on('media:unavailable', (data) => {
  // data: { transferId: 'transfer-1234567890', reason: 'sender_offline' }
});
```

---

#### 21. debug:response
Debug information response.

**Receive:**
```javascript
socket.on('debug:response', (data) => {
  // data: {
  //   your_sid: 'socket-id',
  //   your_name: 'John Doe',
  //   pair_id: '650e8400-e29b-41d4-a716-446655440000',
  //   your_rooms: ['socket-id', 'pair-id'],
  //   participants_in_pair_room: [
  //     { sid: 'socket-id-1', name: 'John Doe' },
  //     { sid: 'socket-id-2', name: 'Jane Doe' }
  //   ]
  // }
});
```

---

## REST vs realtime summary

| Feature | HTTP (REST) | Socket.IO |
|--------|-------------|-----------|
| Auth, profile, pairing, search, push token, public key | Yes | Connect only (`query` / `auth` token) |
| Chat text / media | No | `msg:text`, `media:*`, … |
| **Mood** | **No** | **`mood:update`** (encrypt on device) |
| **Anniversary date** | **No** | **`anniversary:update`** (encrypt on device) |
| Typing | No | `typing:start` / `typing:stop` |

If you are looking for `GET /mood` or `PATCH /anniversary` — they **do not exist** by design; use the Socket.IO events above and local persistence on each device.

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input or operation not allowed |
| 401 | Unauthorized - Invalid or missing authentication token |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists or conflict with current state |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error - Server-side error |

---

## Notes

### Authentication
- All authenticated endpoints require a Bearer token in the Authorization header
- JWT tokens expire after 30 days
- Tokens contain user ID and email in the payload

### Pairing
- Pairing codes are 6 digits (zero-padded)
- Codes expire after a set time (check `expires_at`)
- Only one active pair per user
- Unpairing deletes all offline queues and pending media

### Socket.IO
- Requires JWT token for authentication
- Automatically joins pair room on connection
- Messages are relayed in real-time if partner is online
- Messages are queued in Redis if partner is offline (7-day TTL)
- **Mood** (`mood:update`) and **anniversary** (`anniversary:update`) use the same relay + offline queue pattern; there is **no REST** for these — see [Mood & anniversary](#5-mood--anniversary-e2e--socketio-only-no-rest)
- Media transfers use chunked streaming (never stored on server)
- Maximum media chunk size: 64KB (configurable)

### Security
- Passwords are hashed using bcrypt
- End-to-end encryption supported via public keys
- Messages are encrypted client-side (server only relays)
- CORS enabled for specified origins

---

## Testing

Use the included `test-ui.html` for interactive API testing, or use the Python script:

```bash
python test_socket.py
```

For automated testing, use tools like:
- Postman (REST APIs)
- Socket.IO client libraries (WebSocket events)
