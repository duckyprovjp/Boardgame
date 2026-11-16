import { z } from 'zod';
import { GameIdSchema, type GameId } from './rooms';

export const QueueJoinSchema = z.object({
  gameId: GameIdSchema,
  playerCount: z.number().int().min(2).max(10),
});

export type QueueJoinInput = z.infer<typeof QueueJoinSchema>;

export interface MatchStatusPayload {
  status: 'idle' | 'queuing' | 'matched' | 'timeout';
  gameId?: GameId;
  playerCount?: number;
  queueSize?: number;
  roomCode?: string;
}

export interface PublicRoomSummary {
  code: string;
  gameId: GameId;
  memberCount: number;
  maxPlayers: number;
  hostUsername: string;
}
