import { z } from 'zod';
import type { PublicUser } from './auth';

export type PresenceStatus = 'offline' | 'online' | 'in_game';

export const SearchUsersSchema = z.object({
  q: z.string().trim().min(1, 'Nhập tên người chơi để tìm').max(20),
});

export const SendFriendRequestSchema = z.object({
  targetUserId: z.string().min(1),
});

export const BlockUserSchema = z.object({
  targetUserId: z.string().min(1),
});

export interface FriendInfo extends PublicUser {
  presence: PresenceStatus;
}

export interface FriendRequestInfo {
  id: string;
  fromUser: PublicUser;
  toUser: PublicUser;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED';
  createdAt: string;
}

export type UserRelation =
  | 'none'
  | 'friend'
  | 'outgoing_request'
  | 'incoming_request'
  | 'blocked';

export interface UserSearchResult extends PublicUser {
  relation: UserRelation;
  requestId?: string;
}
