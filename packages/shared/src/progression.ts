import { z } from 'zod';
import type { GameId } from './rooms';

export const ReportPlayerSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().trim().min(3, 'Lý do tối thiểu 3 ký tự').max(300),
});

export const AdminBanSchema = z.object({
  targetUserId: z.string().min(1),
  banned: z.boolean(),
});

export interface UserGameStats {
  gameId: GameId;
  wins: number;
  losses: number;
  elo: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarId: string;
  elo: number;
  wins: number;
  losses: number;
}

export interface MatchHistoryEntry {
  id: string;
  gameId: string;
  roomCode: string;
  won: boolean;
  rank: number;
  createdAt: string;
}
