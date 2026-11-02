/**
 * Client-to-server WebSocket message events.
 */
export const WS_CLIENT_EVENTS = {
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  MESSAGE_SEND: 'message:send',
  MESSAGE_READ: 'message:read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  ROOMS_RESYNC: 'rooms:resync',
} as const;

/**
 * Server-to-client WebSocket broadcast and message events.
 */
export const WS_SERVER_EVENTS = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_READ: 'message:read',
  REACTION_UPDATED: 'reaction:updated',
  TYPING: 'typing',
  PRESENCE_UPDATE: 'presence:update',
  ROOM_UPDATED: 'room:updated',
  MEMBER_JOINED: 'member:joined',
  MEMBER_LEFT: 'member:left',
  ERROR: 'error',
} as const;
