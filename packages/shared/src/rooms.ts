import { z } from 'zod';
import type { PublicUser } from './auth';

export const GameIdSchema = z.enum(['high-card', 'color-uno', 'dice-fate']);
export type GameId = z.infer<typeof GameIdSchema>;

export const ColorUnoRoomOptionsSchema = z.object({
  roundsMode: z.enum(['single', '500']).default('single'),
  turnTimerSec: z.coerce.number().int().min(10).max(60).default(20),
  stackDrawCards: z.boolean().default(false),
  forcedPlayAfterDraw: z.boolean().default(false),
});

export const DiceFateRoomOptionsSchema = z.object({
  turnTimerSec: z.coerce.number().int().min(10).max(60).default(20),
  reactionWindowMs: z.coerce.number().int().min(3000).max(15000).default(5000),
});

export const HighCardRoomOptionsSchema = z.object({
  turnTimerSec: z.coerce.number().int().min(10).max(60).default(20),
});

export type ColorUnoRoomOptions = z.infer<typeof ColorUnoRoomOptionsSchema>;
export type DiceFateRoomOptions = z.infer<typeof DiceFateRoomOptionsSchema>;

export interface GameCatalogItem {
  id: GameId;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  featured: boolean;
}

export const GAME_CATALOG: readonly GameCatalogItem[] = [
  {
    id: 'color-uno',
    name: 'Bài Sắc Màu',
    description: 'Đánh bài theo màu sắc và ký hiệu, thách đấu lá +4 và hết bài trước để thắng',
    minPlayers: 2,
    maxPlayers: 10,
    featured: true,
  },
  {
    id: 'dice-fate',
    name: 'Xúc Xắc Định Mệnh',
    description: 'Lắc xí ngầu sinh tử kết hợp 50 thẻ bài chức năng Xanh & Đỏ đầy kịch tính',
    minPlayers: 3,
    maxPlayers: 8,
    featured: true,
  },
  {
    id: 'high-card',
    name: 'Bài Cao (Thử Nghiệm)',
    description: 'Trò chơi rút bài đơn giản để kiểm tra bàn chơi',
    minPlayers: 2,
    maxPlayers: 4,
    featured: false,
  },
] as const;

export function getGameCatalogItem(gameId: GameId): GameCatalogItem {
  return GAME_CATALOG.find((g) => g.id === gameId) ?? GAME_CATALOG[0]!;
}

export function parseRoomOptions(gameId: GameId, raw?: Record<string, unknown>): Record<string, unknown> {
  if (gameId === 'color-uno') return ColorUnoRoomOptionsSchema.parse(raw ?? {});
  if (gameId === 'dice-fate') return DiceFateRoomOptionsSchema.parse(raw ?? {});
  return HighCardRoomOptionsSchema.parse(raw ?? {});
}

export const RoomVisibilitySchema = z.enum(['public', 'private']);
export type RoomVisibility = z.infer<typeof RoomVisibilitySchema>;

export const CreateRoomSchema = z.object({
  gameId: GameIdSchema,
  maxPlayers: z.number().int().min(2).max(10),
  visibility: RoomVisibilitySchema.default('private'),
  options: z.record(z.unknown()).optional(),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

export const JoinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Mã phòng phải gồm đúng 6 ký tự chữ/số'),
});

export const RoomReadySchema = z.object({
  isReady: z.boolean(),
});

export const RoomKickSchema = z.object({
  targetUserId: z.string().min(1),
});

export const RoomTransferHostSchema = z.object({
  targetUserId: z.string().min(1),
});

export const RoomInviteSchema = z.object({
  targetUserId: z.string().min(1),
  roomCode: z.string().trim().toUpperCase().length(6),
});

export const RoomChatSchema = z.object({
  text: z.string().trim().min(1, 'Tin nhắn không được trống').max(300, 'Tin nhắn tối đa 300 ký tự'),
});

export interface RoomMember extends PublicUser {
  isReady: boolean;
  isHost: boolean;
  connected: boolean;
  isBot?: boolean;
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  text: string;
  createdAt: string;
}

export type RoomStatus = 'lobby' | 'starting' | 'in_game';

export interface RoomState {
  code: string;
  gameId: GameId;
  maxPlayers: number;
  visibility: RoomVisibility;
  options: Record<string, unknown>;
  status: RoomStatus;
  hostId: string;
  members: RoomMember[];
  chat: RoomChatMessage[];
}

export interface RoomInvitePayload {
  roomCode: string;
  gameId: GameId;
  fromUser: PublicUser;
}
