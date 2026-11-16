'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  getAvatarById,
  type FriendInfo,
  type FriendRequestInfo,
  type PresenceStatus,
  type PublicUser,
  type UserSearchResult,
} from '@boardgame/shared';
import { friendsApi } from '@/lib/api';

interface FriendsPanelProps {
  socket: Socket | null;
}

type FriendTab = 'friends' | 'requests' | 'search' | 'blocked';

function PresenceBadge({ status }: { status: PresenceStatus }) {
  const label =
    status === 'online'
      ? 'Trực tuyến'
      : status === 'in_game'
        ? 'Đang trong trận'
        : 'Ngoại tuyến';
  const dotClass =
    status === 'online'
      ? 'bg-emerald-400'
      : status === 'in_game'
        ? 'bg-amber-400'
        : 'bg-slate-500';
  const textClass =
    status === 'online'
      ? 'text-emerald-300'
      : status === 'in_game'
        ? 'text-amber-300'
        : 'text-slate-400';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${textClass}`}>
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

export function FriendsPanel({ socket }: FriendsPanelProps) {
  const [tab, setTab] = useState<FriendTab>('friends');
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestInfo[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestInfo[]>([]);
  const [blocked, setBlocked] = useState<PublicUser[]>([]);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      const data = await friendsApi.list();
      setFriends(data.friends);
      setIncoming(data.incomingRequests);
      setOutgoing(data.outgoingRequests);
      setBlocked(data.blockedUsers);
    } catch {
      // ignore initial error
    }
  }, []);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!socket) return;

    const onPresence = (payload: { userId: string; status: PresenceStatus }) => {
      setFriends((prev) =>
        prev.map((f) => (f.id === payload.userId ? { ...f, presence: payload.status } : f)),
      );
    };

    const onRequestReceived = (req: FriendRequestInfo) => {
      setToast(`Lời mời kết bạn mới từ ${req.fromUser.username}`);
      void loadFriends();
    };

    const onRequestUpdated = () => {
      void loadFriends();
    };

    const onFriendRemoved = () => {
      void loadFriends();
    };

    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
    socket.on(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, onRequestReceived);
    socket.on(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, onRequestUpdated);
    socket.on(SOCKET_EVENTS.FRIEND_REMOVED, onFriendRemoved);

    return () => {
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
      socket.off(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, onRequestReceived);
      socket.off(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, onRequestUpdated);
      socket.off(SOCKET_EVENTS.FRIEND_REMOVED, onFriendRemoved);
    };
  }, [socket, loadFriends]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setSearching(true);
    try {
      const res = await friendsApi.search(query.trim());
      setSearchResults(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tìm kiếm thất bại');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    setError(null);
    try {
      await friendsApi.sendRequest(targetUserId);
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, relation: 'outgoing_request' } : u)),
      );
      await loadFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi lời mời');
    }
  };

  const handleAccept = async (requestId: string) => {
    setError(null);
    try {
      await friendsApi.acceptRequest(requestId);
      await loadFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể chấp nhận');
    }
  };

  const handleDecline = async (requestId: string) => {
    setError(null);
    try {
      await friendsApi.declineRequest(requestId);
      await loadFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể từ chối');
    }
  };

  const handleCancel = async (requestId: string) => {
    setError(null);
    try {
      await friendsApi.cancelRequest(requestId);
      await loadFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể huỷ lời mời');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    setError(null);
    try {
      await friendsApi.removeFriend(friendId);
      await loadFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xoá bạn');
    }
  };

  const handleBlock = async (targetUserId: string) => {
    setError(null);
    try {
      await friendsApi.blockUser(targetUserId);
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, relation: 'blocked' } : u)),
      );
      await loadFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể chặn người dùng');
    }
  };

  const handleUnblock = async (targetUserId: string) => {
    setError(null);
    try {
      await friendsApi.unblockUser(targetUserId);
      await loadFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể bỏ chặn');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-white">Bạn bè & Trạng thái</h2>
        {toast && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300">
            <span>{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="font-bold text-emerald-200 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="mb-4 grid grid-cols-4 gap-1.5 rounded-xl bg-slate-950/70 p-1 text-xs">
        <button
          type="button"
          onClick={() => setTab('friends')}
          className={`rounded-lg py-2 font-medium transition ${
            tab === 'friends' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          Bạn bè ({friends.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('requests')}
          className={`rounded-lg py-2 font-medium transition ${
            tab === 'requests'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Lời mời ({incoming.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('search')}
          className={`rounded-lg py-2 font-medium transition ${
            tab === 'search' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          Tìm bạn
        </button>
        <button
          type="button"
          onClick={() => setTab('blocked')}
          className={`rounded-lg py-2 font-medium transition ${
            tab === 'blocked' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          Đã chặn ({blocked.length})
        </button>
      </div>

      {tab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Chưa có bạn bè. Hãy tìm kiếm người chơi để kết bạn!
            </p>
          ) : (
            friends.map((friend) => {
              const av = getAvatarById(friend.avatarId);
              return (
                <div
                  key={friend.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${av.bgClass}`}
                    >
                      {av.emoji}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{friend.username}</p>
                      <PresenceBadge status={friend.presence} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Huỷ kết bạn
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBlock(friend.id)}
                      className="rounded-lg border border-rose-500/30 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                    >
                      Chặn
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Lời mời đến ({incoming.length})
            </h3>
            {incoming.length === 0 ? (
              <p className="text-xs text-slate-500">Không có lời mời nào.</p>
            ) : (
              <div className="space-y-2">
                {incoming.map((req) => {
                  const av = getAvatarById(req.fromUser.avatarId);
                  return (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{av.emoji}</span>
                        <span className="text-sm font-medium text-white">
                          {req.fromUser.username}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAccept(req.id)}
                          className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                        >
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecline(req.id)}
                          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Đã gửi ({outgoing.length})
            </h3>
            {outgoing.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa gửi lời mời nào.</p>
            ) : (
              <div className="space-y-2">
                {outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <span className="text-sm text-white">{req.toUser.username}</span>
                    <button
                      type="button"
                      onClick={() => handleCancel(req.id)}
                      className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Huỷ lời mời
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm người chơi theo tên..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {searching ? 'Đang tìm...' : 'Tìm'}
            </button>
          </form>

          <div className="space-y-2">
            {searchResults.map((u) => {
              const av = getAvatarById(u.avatarId);
              return (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{av.emoji}</span>
                    <span className="text-sm font-medium text-white">{u.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.relation === 'none' && (
                      <button
                        type="button"
                        onClick={() => handleSendRequest(u.id)}
                        className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        Kết bạn
                      </button>
                    )}
                    {u.relation === 'outgoing_request' && (
                      <span className="text-xs text-slate-400">Đã gửi lời mời</span>
                    )}
                    {u.relation === 'incoming_request' && (
                      <span className="text-xs text-amber-300">Đang chờ bạn xác nhận</span>
                    )}
                    {u.relation === 'friend' && (
                      <span className="text-xs text-emerald-400">Đã là bạn bè</span>
                    )}
                    {u.relation === 'blocked' && (
                      <span className="text-xs text-rose-400">Đã chặn</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'blocked' && (
        <div className="space-y-2">
          {blocked.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Danh sách chặn trống.</p>
          ) : (
            blocked.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              >
                <span className="text-sm text-white">{u.username}</span>
                <button
                  type="button"
                  onClick={() => handleUnblock(u.id)}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Bỏ chặn
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
