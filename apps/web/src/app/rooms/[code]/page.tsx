'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  SOCKET_EVENTS,
  getAvatarById,
  getGameCatalogItem,
  type FriendInfo,
  type RoomState,
} from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';
import { friendsApi } from '@/lib/api';

export default function WaitingRoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = String(params.code ?? '').toUpperCase();
  const { user, loadingAuth, socket, room, setRoom } = useApp();

  const [chatInput, setChatInput] = useState('');
  const [mutedIds, setMutedIds] = useState<string[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<FriendInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !user) return;
    if (!room || room.code !== code) {
      socket.emit(
        SOCKET_EVENTS.ROOM_JOIN,
        { code },
        (res: { ok: boolean; error?: string; room?: RoomState }) => {
          if (res.ok && res.room) {
            setRoom(res.room);
            if (res.room.status === 'in_game') {
              router.replace(`/play/${res.room.code}`);
            }
          } else {
            setError(res.error ?? 'Không tìm thấy phòng');
          }
        },
      );
    } else if (room.status === 'in_game') {
      router.replace(`/play/${room.code}`);
    }
  }, [socket, user, room, code, setRoom, router]);

  useEffect(() => {
    if (!user) return;
    friendsApi
      .list()
      .then((res) => setOnlineFriends(res.friends.filter((f) => f.presence !== 'offline')))
      .catch(() => undefined);
  }, [user]);

  if (loadingAuth || !user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 text-center text-sm text-slate-400">
        Đang vào phòng {code}...
      </main>
    );
  }

  if (!room || room.code !== code) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center">
        <p className="text-sm text-rose-300">{error ?? 'Đang tải thông tin phòng...'}</p>
        <button
          type="button"
          onClick={() => router.push('/games')}
          className="mt-4 cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950"
        >
          Về danh sách trò chơi
        </button>
      </main>
    );
  }

  const isHost = room.hostId === user.id;
  const me = room.members.find((m) => m.id === user.id);

  const handleReady = () => {
    if (!socket || !me) return;
    socket.emit(SOCKET_EVENTS.ROOM_READY, { isReady: !me.isReady }, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setError(res.error ?? 'Lỗi cập nhật trạng thái');
    });
  };

  const handleStart = () => {
    if (!socket) return;
    setError(null);
    socket.emit(SOCKET_EVENTS.ROOM_START, {}, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setError(res.error ?? 'Không thể bắt đầu trận');
    });
  };

  const handleLeave = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.ROOM_LEAVE, {}, () => {
      setRoom(null);
      router.push(`/games/${room.gameId}`);
    });
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!socket || !chatInput.trim()) return;
    socket.emit(SOCKET_EVENTS.ROOM_CHAT_SEND, { text: chatInput.trim() }, (res: { ok: boolean }) => {
      if (res.ok) setChatInput('');
    });
  };

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Phòng chờ · {room.visibility === 'public' ? 'Công khai' : 'Riêng tư'}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {getGameCatalogItem(room.gameId).name}{' '}
            <span className="ml-2 rounded-lg bg-slate-800 px-3 py-1 font-mono text-base text-emerald-300">
              {room.code}
            </span>
          </h1>
        </div>
        <button
          type="button"
          onClick={handleLeave}
          className="cursor-pointer rounded-xl border border-rose-500/40 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
        >
          Rời phòng
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Players */}
        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-sm font-bold text-white">
            Người chơi ({room.members.length}/{room.maxPlayers})
          </h2>
          <div className="space-y-2">
            {room.members.map((m) => {
              const av = getAvatarById(m.avatarId);
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{av.emoji}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">{m.username}</span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          Lv.{m.level ?? 1}
                        </span>
                        {m.isHost && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            Chủ phòng
                          </span>
                        )}
                      </div>
                      <span className={`text-xs ${m.isReady ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {m.isReady ? 'Đã sẵn sàng' : 'Chưa sẵn sàng'}
                      </span>
                    </div>
                  </div>

                  {isHost && m.id !== user.id && (
                    <div className="flex gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          socket?.emit(SOCKET_EVENTS.ROOM_TRANSFER_HOST, { targetUserId: m.id })
                        }
                        className="cursor-pointer rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
                      >
                        Chuyển chủ
                      </button>
                      <button
                        type="button"
                        onClick={() => socket?.emit(SOCKET_EVENTS.ROOM_KICK, { targetUserId: m.id })}
                        className="cursor-pointer rounded border border-rose-500/30 px-2 py-1 text-rose-300 hover:bg-rose-500/10"
                      >
                        Đuổi
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {onlineFriends.filter((f) => !room.members.some((m) => m.id === f.id)).length > 0 && (
            <div className="pt-2">
              <p className="mb-1.5 text-xs text-slate-400">Mời bạn trực tuyến:</p>
              <div className="flex flex-wrap gap-1.5">
                {onlineFriends
                  .filter((f) => !room.members.some((m) => m.id === f.id))
                  .map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        socket?.emit(SOCKET_EVENTS.ROOM_INVITE, {
                          targetUserId: f.id,
                          roomCode: room.code,
                        })
                      }
                      className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 hover:border-amber-400"
                    >
                      + Mời {f.username}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            {isHost ? (
              <button
                type="button"
                onClick={handleStart}
                className="w-full cursor-pointer rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
              >
                Bắt đầu trận
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReady}
                className={`w-full cursor-pointer rounded-xl py-3 text-sm font-bold ${
                  me?.isReady
                    ? 'border border-slate-700 bg-slate-800 text-slate-200'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {me?.isReady ? 'Huỷ sẵn sàng' : 'Sẵn sàng'}
              </button>
            )}
          </div>
        </section>

        {/* Chat */}
        <section className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="mb-3 text-sm font-bold text-white">Trò chuyện trong phòng</h2>
          <div className="mb-3 h-64 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
            {room.chat.filter((m) => !mutedIds.includes(m.senderId)).length === 0 ? (
              <p className="text-slate-500">Chưa có tin nhắn nào.</p>
            ) : (
              room.chat
                .filter((m) => !mutedIds.includes(m.senderId))
                .map((msg) => (
                  <div key={msg.id} className="flex items-center justify-between gap-2">
                    <div>
                      <strong className="text-amber-300">{msg.senderUsername}: </strong>
                      <span className="text-slate-200">{msg.text}</span>
                    </div>
                    {msg.senderId !== user.id && (
                      <button
                        type="button"
                        onClick={() => setMutedIds((prev) => [...prev, msg.senderId])}
                        className="shrink-0 text-[10px] text-slate-500 hover:text-rose-300"
                      >
                        Tắt tiếng
                      </button>
                    )}
                  </div>
                ))
            )}
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              maxLength={300}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Nhập tin nhắn..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              Gửi
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
