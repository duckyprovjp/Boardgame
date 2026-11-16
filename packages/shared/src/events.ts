import { z } from 'zod';

export const SOCKET_EVENTS = {
  PING: 'ping',
  PONG: 'pong',
  AUTH_READY: 'auth:ready',
  PRESENCE_UPDATE: 'presence:update',
  FRIEND_REQUEST_RECEIVED: 'friends:request_received',
  FRIEND_REQUEST_UPDATED: 'friends:request_updated',
  FRIEND_REMOVED: 'friends:removed',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_STATE: 'room:state',
  ROOM_READY: 'room:ready',
  ROOM_KICK: 'room:kick',
  ROOM_KICKED: 'room:kicked',
  ROOM_TRANSFER_HOST: 'room:transfer_host',
  ROOM_INVITE: 'room:invite',
  ROOM_INVITE_RECEIVED: 'room:invite_received',
  ROOM_CHAT_SEND: 'room:chat_send',
  ROOM_CHAT_MESSAGE: 'room:chat_message',
  ROOM_START: 'room:start',
  ROOM_STARTING: 'room:starting',
  GAME_ACTION: 'game:action',
  GAME_STATE: 'game:state',
  GAME_OVER: 'game:over',
  GAME_RETURN_LOBBY: 'game:return_lobby',
  MATCH_JOIN_QUEUE: 'match:join_queue',
  MATCH_CANCEL_QUEUE: 'match:cancel_queue',
  MATCH_FILL_BOTS: 'match:fill_bots',
  MATCH_STATUS: 'match:status',
  MATCH_FOUND: 'match:found',
} as const;

export const PingPayloadSchema = z.object({
  clientTime: z.number().int().nonnegative(),
  message: z.string().trim().min(1).max(100).optional(),
});

export type PingPayload = z.infer<typeof PingPayloadSchema>;

export const PongPayloadSchema = z.object({
  clientTime: z.number().int().nonnegative(),
  serverTime: z.number().int().nonnegative(),
  message: z.string(),
});

export type PongPayload = z.infer<typeof PongPayloadSchema>;
