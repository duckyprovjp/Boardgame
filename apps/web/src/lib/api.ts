import type {
  AuthUser,
  FriendInfo,
  FriendRequestInfo,
  GameId,
  GuestLoginInput,
  LeaderboardEntry,
  LoginInput,
  MatchHistoryEntry,
  PublicRoomSummary,
  PublicUser,
  RegisterInput,
  UpdateProfileInput,
  UserGameStats,
  UserSearchResult,
} from '@boardgame/shared';

function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  throw new Error('NEXT_PUBLIC_API_URL is not configured');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Có lỗi xảy ra, vui lòng thử lại');
  }
  return data;
}

export const authApi = {
  me: () => request<{ user: AuthUser; socketToken?: string }>('/api/auth/me'),
  register: (body: RegisterInput) =>
    request<{ user: AuthUser; socketToken?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: LoginInput) =>
    request<{ user: AuthUser; socketToken?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  guest: (body: Partial<GuestLoginInput> = {}) =>
    request<{ user: AuthUser; socketToken?: string }>('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),
  updateProfile: (body: UpdateProfileInput) =>
    request<{ user: AuthUser }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export interface FriendsOverview {
  friends: FriendInfo[];
  incomingRequests: FriendRequestInfo[];
  outgoingRequests: FriendRequestInfo[];
  blockedUsers: PublicUser[];
}

export const friendsApi = {
  list: () => request<FriendsOverview>('/api/friends'),
  search: (q: string) =>
    request<{ users: UserSearchResult[] }>(`/api/friends/search?q=${encodeURIComponent(q)}`),
  sendRequest: (targetUserId: string) =>
    request<{ request: FriendRequestInfo }>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
  acceptRequest: (requestId: string) =>
    request<{ ok: boolean; friend: FriendInfo }>(
      `/api/friends/requests/${encodeURIComponent(requestId)}/accept`,
      { method: 'POST' },
    ),
  declineRequest: (requestId: string) =>
    request<{ ok: boolean }>(`/api/friends/requests/${encodeURIComponent(requestId)}/decline`, {
      method: 'POST',
    }),
  cancelRequest: (requestId: string) =>
    request<{ ok: boolean }>(`/api/friends/requests/${encodeURIComponent(requestId)}/cancel`, {
      method: 'POST',
    }),
  removeFriend: (friendId: string) =>
    request<{ ok: boolean }>(`/api/friends/${encodeURIComponent(friendId)}`, {
      method: 'DELETE',
    }),
  blockUser: (targetUserId: string) =>
    request<{ ok: boolean }>('/api/friends/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
  unblockUser: (targetUserId: string) =>
    request<{ ok: boolean }>(`/api/friends/block/${encodeURIComponent(targetUserId)}`, {
      method: 'DELETE',
    }),
};

export const roomsApi = {
  listPublic: () => request<{ rooms: PublicRoomSummary[] }>('/api/rooms/public'),
};

export const progressionApi = {
  me: () => request<{ stats: UserGameStats[]; history: MatchHistoryEntry[] }>('/api/progression/me'),
  leaderboard: (gameId: GameId, scope: 'global' | 'friends') =>
    request<{ gameId: GameId; scope: string; entries: LeaderboardEntry[] }>(
      `/api/progression/leaderboard?gameId=${encodeURIComponent(gameId)}&scope=${scope}`,
    ),
};

export const safetyApi = {
  report: (targetUserId: string, reason: string) =>
    request<{ ok: boolean }>('/api/safety/report', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason }),
    }),
};
