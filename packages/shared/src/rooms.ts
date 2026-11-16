import { z } from 'zod';
import type { PublicUser } from './auth';

export const GameIdSchema = z.enum([
  'high-card',
  'color-uno',
  'meo-no',
  'dice-fate',
  'poker',
  'blackjack',
]);
export type GameId = z.infer<typeof GameIdSchema>;

export interface GameCatalogItem {
  id: GameId;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export const GAME_CATALOG: readonly GameCatalogItem[] = [
  {
    id: 'high-card',
    name: 'Bài Cao (Thử Nghiệm)',
    description: 'Trò chơi rút bài đơn giản để kiểm tra bàn chơi',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    id: 'color-uno',
    name: 'Sắc Màu Vui Nhộn',
    description: 'Đánh bài theo màu sắc và ký hiệu, hết bài trước để thắng',
    minPlayers: 2,
    maxPlayers: 10,
  },
  {
    id: 'meo-no',
    name: 'Mèo Nổ',
    description: 'Rút bài né bom nổ, dùng thẻ gỡ bom và chiến thuật',
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    id: 'dice-fate',
    name: 'Xúc Xắc Định Mệnh',
    description: 'Lắc xí ngầu kết hợp thẻ bài xanh đỏ đầy bất ngờ',
    minPlayers: 3,
    maxPlayers: 8,
  },
  {
    id: 'poker',
    name: 'Poker (Xì Tố)',
    description: 'Texas Hold\'em 2 lá tẩy + 5 lá chung, tố/theo/úp bài',
    minPlayers: 2,
    maxPlayers: 8,
  },
  {
    id: 'blackjack',
    name: 'Blackjack (Xì Dách)',
    description: 'Rút bài đạt gần 21 điểm nhất mà không bị Quắc (>21)',
    minPlayers: 2,
    maxPlayers: 7,
  },
] as const;

export function getGameCatalogItem(gameId: GameId): GameCatalogItem {
  return GAME_CATALOG.find((g) => g.id === gameId) ?? GAME_CATALOG[0]!;
}

export const RoomVisibilitySchema = z.enum(['public', 'private']);
export type RoomVisibility = z.infer<typeof RoomVisibilitySchema>;

export const CreateRoomSchema = z.object({
  gameId: GameIdSchema,
  maxPlayers: z.number().int().min(2).max(10),
  visibility: RoomVisibilitySchema.default('private'),
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
