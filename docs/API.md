# Kyu Chatter — REST & WebSocket API Specification

This document specifies the complete REST and WebSocket API contract for Kyu Chatter (`apps/backend`).
It serves as the authoritative source of truth for the frontend application.

---

## 1. Global Conventions & Protocol

### 1.1 Base URLs & Prefixes
- **REST Endpoints**: Sub-routed per domain with `@Controller('api/...')` or `@Controller('health')`.
  - Notice: Better Auth handles `/api/auth/*` natively (Google OAuth, email OTP, session, etc.).
- **Global Prefix**: There is **no global prefix** set on the application (`app.setGlobalPrefix(...)` is NOT used), ensuring Better Auth routes are mounted exactly at `/api/auth/*`.

### 1.2 Authentication & Development Fallback
- Authenticated endpoints resolve the user from the active Better Auth session.
- **Development-Only Fallback**: When `NODE_ENV !== 'production'` and `ALLOW_DEV_USER_HEADER === 'true'`, passing the `x-dev-user-id: <userId>` HTTP header allows simulating an authenticated user with that ID without a live session cookie.
  - If no session or dev header is present on protected routes, `401 Unauthorized` is returned.

### 1.3 Uniform Success Envelope
All 200/201 JSON responses from domain controllers are automatically wrapped by the `TransformResponseInterceptor`:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "nodeId": "node-1",
    "timestamp": "2026-11-02T04:10:00.000Z"
  }
}
```

- **Excluded from Envelope**:
  - `204 No Content` responses (no response body).
  - Health check endpoints (`/health/*`).
  - Better Auth endpoints (`/api/auth/*`).

### 1.4 Response Headers
- Every response (both success and error) includes the `X-Node-Id` header identifying which distributed backend instance handled the request (e.g. `X-Node-Id: node-1`).
- Clients that inspect custom headers across origins should ensure CORS `exposedHeaders` contains `X-Node-Id`.

### 1.5 Uniform Error Envelope
Exceptions and validation failures are caught globally by `AllExceptionsFilter` and returned in a consistent schema:

```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "message": "Validation failed",
    "details": [
      "body or mediaIds: Message must contain either text body or at least one media attachment"
    ],
    "path": "/api/rooms/018f3a5a-8b9a-7c2d-9e1f-111111111111/messages",
    "timestamp": "2026-11-02T04:10:00.000Z"
  },
  "meta": {
    "nodeId": "node-1"
  }
}
```

- **Database Conflict / Not Found Mapping**:
  - Prisma `P2002` (Unique constraint violation) is mapped to `409 Conflict`.
  - Prisma `P2025` (Record not found) is mapped to `404 Not Found`.

### 1.6 ID Formats
- **User IDs**: Plain strings (Better Auth generated IDs, `1` to `64` characters, e.g. `usr_123456789`).
- **Domain IDs**: UUIDv7 strings (`roomId`, `messageId`, `mediaId`, `attachmentId`), validated via `@IsUUID('all')`.

---

## 2. Health Endpoints

Health checks are public endpoints used by Docker, load balancers, and orchestrators. They bypass the response envelope.

| Method | Path | Status | Response Shape | Description |
|---|---|---|---|---|
| `GET` | `/health/live` | 200 | `{"status": "ok"}` | Liveness probe (process responsive) |
| `GET` | `/health/ready` | 200 | `{"status": "ok", "db": "ok"}` | Readiness probe (database connection active) |
| `GET` | `/health/node` | 200 | `{"nodeId": "node-1"}` | Returns current node identifier |

---

## 3. Users Endpoints (`/api/users`)

### 3.1 Get Current User
- **Method / Path**: `GET /api/users/me`
- **Auth**: Required
- **Response**: `200 OK`
```json
{
  "id": "usr_abc123",
  "email": "user@example.com",
  "name": "Jane Doe",
  "image": "https://example.com/avatar.jpg",
  "createdAt": "2026-11-01T00:00:00.000Z"
}
```

### 3.2 Update Current User Profile
- **Method / Path**: `PATCH /api/users/me`
- **Auth**: Required
- **Request Body** (`UpdateProfileDto` - at least one field required):
  - `name`: `string` (optional, 1-80 chars)
  - `image`: `string` (optional, valid HTTPS URL, max 2048 chars)
- **Response**: `200 OK` (returns updated `UserProfileResponse`)

### 3.3 Search Users
- **Method / Path**: `GET /api/users/search?q=...&limit=...`
- **Auth**: Required
- **Query Parameters** (`SearchUsersQueryDto`):
  - `q`: `string` (required, 2-64 chars)
  - `limit`: `number` (optional, integer 1-20, default `10`)
- **Response**: `200 OK` -> array of `UserSummaryResponse`:
```json
[
  {
    "id": "usr_def456",
    "name": "Alice Smith",
    "image": null
  }
]
```

### 3.4 Get User Profile by ID
- **Method / Path**: `GET /api/users/:id`
- **Auth**: Required
- **Path Parameters**: `id` (`string`, 1-64 chars)
- **Response**: `200 OK`
```json
{
  "id": "usr_def456",
  "name": "Alice Smith",
  "image": null,
  "createdAt": "2026-11-01T00:00:00.000Z"
}
```

---

## 4. Presence Endpoints (`/api/presence`)

### 4.1 Batch Query Presence
- **Method / Path**: `GET /api/presence?userIds=usr_1,usr_2`
- **Auth**: Required
- **Query Parameters** (`PresenceQueryDto`):
  - `userIds`: `string` (required, comma-separated user IDs, 1-100 IDs)
- **Response**: `200 OK` (`PresenceResponse` - dictionary mapping user ID to status):
```json
{
  "usr_1": {
    "status": "ONLINE"
  },
  "usr_2": {
    "status": "OFFLINE",
    "lastSeenAt": "2026-11-02T03:30:00.000Z"
  }
}
```

---

## 5. Rooms Endpoints (`/api/rooms`)

### 5.1 Create Group Room
- **Method / Path**: `POST /api/rooms`
- **Auth**: Required
- **Request Body** (`CreateGroupRoomDto`):
  - `name`: `string` (required, 1-100 chars)
  - `description`: `string` (optional, max 500 chars)
  - `image`: `string` (optional, HTTPS URL, max 2048 chars)
  - `memberUserIds`: `string[]` (required, array of 1-99 user IDs to invite)
- **Response**: `201 Created` (`RoomDetailResponse`)

### 5.2 Create or Get Direct Message Room
- **Method / Path**: `POST /api/rooms/direct`
- **Auth**: Required
- **Request Body** (`CreateDirectRoomDto`):
  - `targetUserId`: `string` (required, 1-64 chars)
- **Response**: `200 OK` (`RoomDetailResponse`)
- **Note**: Idempotent. Returns existing direct room between current user and target user if already created.

### 5.3 List Joined Rooms
- **Method / Path**: `GET /api/rooms?cursor=...&limit=...&type=...&isArchived=...`
- **Auth**: Required
- **Query Parameters** (`ListRoomsQueryDto`):
  - `cursor`: `string` (optional, UUIDv7 cursor)
  - `limit`: `number` (optional, integer 1-100, default `30`)
  - `type`: `string` (optional, enum: `'GROUP' | 'DIRECT'`)
  - `isArchived`: `boolean` (optional, `'true' | 'false'`)
- **Response**: `200 OK` (`RoomPageResponse`):
```json
{
  "items": [
    {
      "id": "018f3a5a-8b9a-7c2d-9e1f-111111111111",
      "type": "GROUP",
      "name": "General Chat",
      "description": "Welcome to general",
      "image": null,
      "memberCount": 5,
      "lastMessage": {
        "id": "018f3a5a-8b9a-7c2d-9e1f-222222222222",
        "senderId": "usr_123",
        "body": "Hello world",
        "createdAt": "2026-11-02T04:00:00.000Z"
      },
      "unreadCount": 0,
      "preference": {
        "isMuted": false,
        "isArchived": false,
        "isPinned": false
      },
      "updatedAt": "2026-11-02T04:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

### 5.4 Get Room Details
- **Method / Path**: `GET /api/rooms/:roomId`
- **Auth**: Required
- **Path Parameters**: `roomId` (UUIDv7)
- **Response**: `200 OK` (`RoomDetailResponse`, includes `members` list)

### 5.5 Update Group Room
- **Method / Path**: `PATCH /api/rooms/:roomId`
- **Auth**: Required (Owner or Admin)
- **Path Parameters**: `roomId` (UUIDv7)
- **Request Body** (`UpdateRoomDto` - at least one field required):
  - `name`: `string` (optional, 1-100 chars)
  - `description`: `string` (optional, max 500 chars)
  - `image`: `string` (optional, HTTPS URL, max 2048 chars)
- **Response**: `200 OK` (`RoomDetailResponse`)

### 5.6 Delete Group Room
- **Method / Path**: `DELETE /api/rooms/:roomId`
- **Auth**: Required (Owner only)
- **Path Parameters**: `roomId` (UUIDv7)
- **Response**: `204 No Content`

### 5.7 List Room Members
- **Method / Path**: `GET /api/rooms/:roomId/members`
- **Auth**: Required (Must be a member)
- **Path Parameters**: `roomId` (UUIDv7)
- **Response**: `200 OK` -> array of `RoomMemberResponse`:
```json
[
  {
    "roomId": "018f3a5a-8b9a-7c2d-9e1f-111111111111",
    "userId": "usr_abc123",
    "role": "OWNER",
    "joinedAt": "2026-11-01T00:00:00.000Z",
    "user": {
      "id": "usr_abc123",
      "name": "Jane Doe",
      "image": null
    }
  }
]
```

### 5.8 Add Members to Room
- **Method / Path**: `POST /api/rooms/:roomId/members`
- **Auth**: Required (Owner or Admin)
- **Path Parameters**: `roomId` (UUIDv7)
- **Request Body** (`AddMembersDto`):
  - `userIds`: `string[]` (required, array of 1-100 unique user IDs)
- **Response**: `200 OK` -> array of `RoomMemberResponse`

### 5.9 Remove Member from Room
- **Method / Path**: `DELETE /api/rooms/:roomId/members/:userId`
- **Auth**: Required (Owner or Admin removing member)
- **Path Parameters**:
  - `roomId` (UUIDv7)
  - `userId` (string, 1-64 chars)
- **Response**: `204 No Content`

### 5.10 Update Member Role
- **Method / Path**: `PATCH /api/rooms/:roomId/members/:userId`
- **Auth**: Required (Owner only)
- **Path Parameters**: `roomId` (UUIDv7), `userId` (string)
- **Request Body** (`UpdateMemberRoleDto`):
  - `role`: `string` (required, enum: `'ADMIN' | 'MEMBER'`)
- **Response**: `200 OK` (`RoomMemberResponse`)

### 5.11 Leave Room
- **Method / Path**: `POST /api/rooms/:roomId/leave`
- **Auth**: Required
- **Path Parameters**: `roomId` (UUIDv7)
- **Response**: `204 No Content`

### 5.12 Update Room Preferences
- **Method / Path**: `PATCH /api/rooms/:roomId/preferences`
- **Auth**: Required
- **Path Parameters**: `roomId` (UUIDv7)
- **Request Body** (`UpdateRoomPreferenceDto` - at least one field required):
  - `isMuted`: `boolean` (optional)
  - `isArchived`: `boolean` (optional)
  - `isPinned`: `boolean` (optional)
- **Response**: `200 OK` (`RoomPreferenceResponse`):
```json
{
  "roomId": "018f3a5a-8b9a-7c2d-9e1f-111111111111",
  "userId": "usr_abc123",
  "isMuted": true,
  "isArchived": false,
  "isPinned": true
}
```

### 5.13 Mark Room as Read
- **Method / Path**: `POST /api/rooms/:roomId/read`
- **Auth**: Required
- **Path Parameters**: `roomId` (UUIDv7)
- **Request Body** (`MarkReadDto`):
  - `messageId`: `string` (required, UUIDv7 of latest read message)
- **Response**: `200 OK` (`MarkReadResponse`):
```json
{
  "roomId": "018f3a5a-8b9a-7c2d-9e1f-111111111111",
  "userId": "usr_abc123",
  "lastReadMessageId": "018f3a5a-8b9a-7c2d-9e1f-222222222222",
  "readAt": "2026-11-02T04:10:00.000Z"
}
```

---

## 6. Messages Endpoints

Messages are accessible either scoped under a room (`/api/rooms/:roomId/messages`) or directly by message ID (`/api/messages/:messageId`).

### 6.1 Resync Messages After Disconnect
- **Method / Path**: `GET /api/rooms/:roomId/messages/sync?afterId=...&limit=...`
- **Auth**: Required
- **Path Parameters**: `roomId` (UUIDv7)
- **Query Parameters** (`SyncMessagesQueryDto`):
  - `afterId`: `string` (required, UUIDv7)
  - `limit`: `number` (optional, integer 1-100, default `50`)
- **Response**: `200 OK` (`MessagePageResponse`)

### 6.2 Paginate Messages in Room
- **Method / Path**: `GET /api/rooms/:roomId/messages?cursor=...&limit=...&direction=...`
- **Auth**: Required
- **Path Parameters**: `roomId` (UUIDv7)
- **Query Parameters** (`ListMessagesQueryDto`):
  - `cursor`: `string` (optional, UUIDv7)
  - `limit`: `number` (optional, integer 1-100, default `30`)
  - `direction`: `string` (optional, enum: `'before' | 'after'`, default `'before'`)
- **Response**: `200 OK` (`MessagePageResponse`):
```json
{
  "items": [
    {
      "id": "018f3a5a-8b9a-7c2d-9e1f-222222222222",
      "roomId": "018f3a5a-8b9a-7c2d-9e1f-111111111111",
      "senderId": "usr_abc123",
      "clientMessageId": "018f3a5a-8b9a-7c2d-9e1f-333333333333",
      "body": "Hello world!",
      "replyToId": null,
      "nodeId": "node-1",
      "createdAt": "2026-11-02T04:00:00.000Z",
      "editedAt": null,
      "deletedAt": null,
      "sender": {
        "id": "usr_abc123",
        "name": "Jane Doe",
        "image": null
      },
      "attachments": [],
      "reactions": []
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

### 6.3 Send Message (HTTP REST)
- **Method / Path**: `POST /api/rooms/:roomId/messages`
- **Auth**: Required
- **Path Parameters**: `roomId` (UUIDv7)
- **Request Body** (`SendMessageDto` - requires at least `body` or `mediaIds`):
  - `clientMessageId`: `string` (required, UUIDv7 client-side deduplication id)
  - `body`: `string` (optional, 1-4000 chars)
  - `replyToId`: `string` (optional, UUIDv7)
  - `mediaIds`: `string[]` (optional, array of 1-10 UUIDv7s)
- **Response**: `201 Created` (`MessageResponse`)

### 6.4 Edit Message
- **Method / Path**: `PATCH /api/messages/:messageId`
- **Auth**: Required (Author only)
- **Path Parameters**: `messageId` (UUIDv7)
- **Request Body** (`EditMessageDto`):
  - `body`: `string` (required, 1-4000 chars)
- **Response**: `200 OK` (`MessageResponse`)

### 6.5 Delete Message (Soft Delete)
- **Method / Path**: `DELETE /api/messages/:messageId`
- **Auth**: Required (Author or Room Admin/Owner)
- **Path Parameters**: `messageId` (UUIDv7)
- **Response**: `204 No Content`

### 6.6 Add Reaction
- **Method / Path**: `POST /api/messages/:messageId/reactions`
- **Auth**: Required
- **Path Parameters**: `messageId` (UUIDv7)
- **Request Body** (`AddReactionDto`):
  - `emoji`: `string` (required, 1-16 chars, e.g. "👍")
- **Response**: `200 OK` -> array of `ReactionSummaryResponse`:
```json
[
  {
    "emoji": "👍",
    "count": 1,
    "hasReacted": true,
    "userIds": ["usr_abc123"]
  }
]
```

### 6.7 Remove Reaction
- **Method / Path**: `DELETE /api/messages/:messageId/reactions?emoji=...`
- **Auth**: Required
- **Path Parameters**: `messageId` (UUIDv7)
- **Query Parameters** (`RemoveReactionQueryDto`):
  - `emoji`: `string` (required, 1-16 chars)
- **Response**: `200 OK` -> array of `ReactionSummaryResponse`

### 6.8 Get Message Delivery Receipts
- **Method / Path**: `GET /api/messages/:messageId/receipts`
- **Auth**: Required
- **Path Parameters**: `messageId` (UUIDv7)
- **Response**: `200 OK` -> array of `ReceiptResponse`:
```json
[
  {
    "messageId": "018f3a5a-8b9a-7c2d-9e1f-222222222222",
    "userId": "usr_def456",
    "status": "READ",
    "updatedAt": "2026-11-02T04:05:00.000Z"
  }
]
```

---

## 7. Media Endpoints (`/api/media`)

Direct uploads bypass backend file streams by generating a presigned Cloudinary upload signature.

### 7.1 Request Direct Upload Signature
- **Method / Path**: `POST /api/media/signature`
- **Auth**: Required
- **Request Body** (`RequestUploadSignatureDto`):
  - `filename`: `string` (required, 1-255 chars)
  - `mimeType`: `string` (required, must match allowed regex: `image/(jpeg|png|webp|gif)`, `video/(mp4|webm|quicktime)`, `audio/(mpeg|ogg|wav|webm)`, `application/pdf`, etc.)
  - `bytes`: `number` (required, 1 to 26,214,400 bytes [25MB max])
  - `kind`: `string` (required, enum: `'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE'`)
- **Response**: `200 OK` (`UploadSignatureResponse`):
```json
{
  "mediaId": "018f3a5a-8b9a-7c2d-9e1f-444444444444",
  "uploadUrl": "https://api.cloudinary.com/v1_1/placeholder-cloud/auto/upload",
  "storageKey": "chat-uploads/usr_abc123/018f3a5a-8b9a-7c2d-9e1f-444444444444",
  "params": {
    "timestamp": 1798863000,
    "signature": "placeholder-signature-sha256",
    "api_key": "placeholder-api-key",
    "public_id": "chat-uploads/usr_abc123/018f3a5a-8b9a-7c2d-9e1f-444444444444"
  },
  "expiresAt": "2026-11-02T04:40:00.000Z"
}
```

### 7.2 Confirm Upload Success
- **Method / Path**: `POST /api/media/confirm`
- **Auth**: Required
- **Request Body** (`ConfirmUploadDto`):
  - `mediaId`: `string` (required, UUIDv7)
  - `storageKey`: `string` (required, 1-512 chars)
  - `url`: `string` (required, HTTPS URL)
  - `width`: `number` (optional, integer min 1)
  - `height`: `number` (optional, integer min 1)
  - `duration`: `number` (optional, integer min 1)
- **Response**: `200 OK` (`MediaResponse`):
```json
{
  "id": "018f3a5a-8b9a-7c2d-9e1f-444444444444",
  "storageKey": "chat-uploads/usr_abc123/018f3a5a-8b9a-7c2d-9e1f-444444444444",
  "url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  "kind": "IMAGE",
  "status": "READY",
  "bytes": 204800,
  "width": 1920,
  "height": 1080,
  "duration": null,
  "createdAt": "2026-11-02T04:10:00.000Z"
}
```

### 7.3 Get Media Metadata
- **Method / Path**: `GET /api/media/:mediaId`
- **Auth**: Required
- **Path Parameters**: `mediaId` (UUIDv7)
- **Response**: `200 OK` (`MediaResponse`)

### 7.4 Delete Media
- **Method / Path**: `DELETE /api/media/:mediaId`
- **Auth**: Required (Owner only)
- **Path Parameters**: `mediaId` (UUIDv7)
- **Response**: `204 No Content`

---

## 8. WebSocket Gateway & Events

The WebSocket gateway is exposed via Socket.IO (`ChatGateway`). Incoming payloads are automatically validated using NestJS `ValidationPipe`.

### 8.1 Client-to-Server Events (`WS_CLIENT_EVENTS`)

| Event Name | DTO Class | Payload Fields & Validation | Server Ack / Response |
|---|---|---|---|
| `room:join` | `JoinRoomWsDto` | `roomId` (`@IsUUID('all')`) | `{ ok: true, roomId }` |
| `room:leave` | `LeaveRoomWsDto` | `roomId` (`@IsUUID('all')`) | `{ ok: true, roomId }` |
| `message:send` | `SendMessageWsDto` | `roomId` (`UUID`), `clientMessageId` (`UUID`), `body?` (1-4000), `replyToId?` (`UUID`), `mediaIds?` (`UUID[]`). *Body or mediaIds required.* | `{ ok: true, clientMessageId }` |
| `message:read` | `MarkReadWsDto` | `roomId` (`UUID`), `messageId` (`UUID`) | `{ ok: true, messageId }` |
| `typing:start` | `TypingWsDto` | `roomId` (`UUID`) | `{ ok: true }` |
| `typing:stop` | `TypingWsDto` | `roomId` (`UUID`) | `{ ok: true }` |
| `room:sync` | `ResyncWsDto` | `roomId` (`UUID`), `afterMessageId?` (`UUID`) | `{ ok: true, roomId }` |

### 8.2 Server-to-Client Events (`WS_SERVER_EVENTS`)

| Event Name | Broadcast Scope | Payload Schema | Description |
|---|---|---|---|
| `message:new` | Room members | `MessageResponse` | Broadcast when a new message is posted |
| `message:updated` | Room members | `MessageResponse` | Broadcast when an existing message is edited |
| `message:deleted` | Room members | `{ messageId: string, roomId: string }` | Broadcast when a message is soft-deleted |
| `message:reaction` | Room members | `{ messageId: string, reactions: ReactionSummaryResponse[] }` | Broadcast when a reaction is added or removed |
| `message:receipt` | Room members | `ReceiptResponse` | Broadcast when a message is delivered or read |
| `typing:change` | Room members (excl. sender) | `{ roomId: string, userId: string, isTyping: boolean }` | Broadcast when a user starts or stops typing |
| `presence:change` | Subscribed peers / Contacts | `{ userId: string, status: 'ONLINE' \| 'OFFLINE', lastSeenAt?: string }` | Broadcast when user connectivity state changes |
| `room:member_joined` | Room members | `RoomMemberResponse` | Broadcast when a new member is added |
| `room:member_left` | Room members | `{ roomId: string, userId: string }` | Broadcast when a member leaves or is removed |
| `room:updated` | Room members | `RoomDetailResponse` | Broadcast when room metadata changes |
| `error` | Emitting socket | `{ code: string, message: string, details?: unknown }` | Sent on validation or operational errors |

---

## 9. Error Codes Summary

| Status Code | Meaning | Common Triggers |
|---|---|---|
| `400 Bad Request` | Validation Failure | Invalid UUID, missing required fields, exceeding body/length limits |
| `401 Unauthorized` | Not Authenticated | Missing session cookie or missing `x-dev-user-id` in dev mode |
| `403 Forbidden` | Access Denied | Non-owner attempting admin action; non-member accessing private room |
| `404 Not Found` | Entity Missing | Record not found in database (Prisma P2025) |
| `409 Conflict` | Unique Violation | Duplicate direct key or unique constraint violation (Prisma P2002) |
| `500 Internal Error` | Server Exception | Uncaught runtime error; full stack trace logged to server console |
