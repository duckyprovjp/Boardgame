'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  GAME_CATALOG,
  SOCKET_EVENTS,
  getGameCatalogItem,
  type GameId,
  type PublicRoomSummary,
  type RoomState,
} from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';
import { roomsApi } from '@/lib/api';

export default function GameLobbyPage() {
  const params = useParams<{ game: string }>();
  const router = useRouter();
  const { user, loadingAuth, socket, matchStatus, setMatchStatus, setRoom } = useApp();

  const gameId = (
    GAME_CATALOG.some((g) => g.id === params.game) ? params.game : 'color-uno'
  ) as GameId;
  const game = getGameCatalogItem(gameId);

  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [quickPlayers, setQuickPlayers] = useState(Math.max(game.minPlayers, 4));
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await roomsApi.listPublic();
      setPublicRooms(res.rooms.filter((r) => r.gameId === gameId));
    } catch {
      setPublicRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (user) void loadRooms();
  }, [user, loadRooms]);

  if (loadingAuth || !user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-400">
        Đang tải sảnh {game.name}...
      </main>
    );
  }

  const joinRoomByCode = (code: string) => {
    if (!socket) return;
    setError(null);
    socket.emit(
      SOCKET_EVENTS.ROOM_JOIN,
      { code: code.trim().toUpperCase() },
      (res: { ok: boolean; error?: string; room?: RoomState }) => {
        if (!res.ok || !res.room) {
          setError(res.error ?? 'Không thể tham gia phòng');
          return;
        }
        setRoom(res.room);
        router.push(`/rooms/${res.room.code}`);
      },
    );
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    joinRoomByCode(joinCode);
  };

  const handleQuickPlay = () => {
    if (!socket) return;
    setError(null);
    socket.emit(
      SOCKET_EVENTS.MATCH_JOIN_QUEUE,
      { gameId, playerCount: quickPlayers },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok) setError(res.error ?? 'Không thể tìm trận');
      },
    );
  };

  const handleCancelQueue = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.MATCH_CANCEL_QUEUE, {}, () => {
      setMatchStatus({ status: 'idle' });
    });
  };

  const handleFillBots = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.MATCH_FILL_BOTS, {}, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setError(res.error ?? 'Không thể thêm Bot');
    });
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/games" className="text-xs text-slate-400 hover:text-amber-300">
            ← Tất cả trò chơi
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-white">{game.name}</h1>
          <p className="text-xs text-slate-400">{game.description}</p>
        </div>

        <Link
          href={`/games/${gameId}/create`}
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
        >
          + Tạo phòng mới
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Quick Play */}
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h2 className="text-base font-bold text-emerald-300">Chơi nhanh (Ghép ngẫu nhiên)</h2>
          <p className="mt-1 text-xs text-slate-400">
            Tìm người chơi ngẫu nhiên theo số người mong muốn ({game.minPlayers}–{game.maxPlayers})
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-300">Số người:</label>
            <input
              type="number"
              min={game.minPlayers}
              max={game.maxPlayers}
              value={quickPlayers}
              onChange={(e) =>
                setQuickPlayers(
                  Math.min(game.maxPlayers, Math.max(game.minPlayers, Number(e.target.value))),
                )
              }
              className="w-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white"
            />

            {matchStatus.status === 'idle' || matchStatus.status === 'matched' ? (
              <button
                type="button"
                onClick={handleQuickPlay}
                className="cursor-pointer rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                Tìm trận ngay
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-amber-300">
                  {matchStatus.status === 'timeout'
                    ? 'Hết giờ chờ — có thể ghép Bot!'
                    : `Đang chờ (${matchStatus.queueSize ?? 1}/${matchStatus.playerCount ?? quickPlayers})...`}
                </span>
                <button
                  type="button"
                  onClick={handleFillBots}
                  className="cursor-pointer rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950"
                >
                  Chơi với Bot
                </button>
                <button
                  type="button"
                  onClick={handleCancelQueue}
                  className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
                >
                  Huỷ
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Join by code */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-base font-bold text-white">Vào phòng bằng mã</h2>
          <p className="mt-1 text-xs text-slate-400">Nhập mã phòng 6 ký tự từ bạn bè</p>
          <form onSubmit={handleJoinSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="VD: AB23CD"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-sm uppercase tracking-widest text-white outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={joinCode.trim().length !== 6}
              className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Vào phòng
            </button>
          </form>
        </section>
      </div>

      {/* Public Table List */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Danh sách bàn công khai</h2>
          <button
            type="button"
            onClick={() => void loadRooms()}
            className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Làm mới
          </button>
        </div>

        {loadingRooms ? (
          <p className="py-6 text-center text-xs text-slate-400">Đang tải danh sách bàn...</p>
        ) : publicRooms.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            Chưa có bàn công khai nào cho {game.name}. Hãy tạo bàn mới!
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {publicRooms.map((r) => (
              <div
                key={r.code}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs"
              >
                <div>
                  <p className="font-bold text-white">
                    Chủ phòng: {r.hostUsername}{' '}
                    <span className="ml-1 font-mono text-amber-300">#{r.code}</span>
                  </p>
                  <p className="mt-1 text-slate-400">
                    Số ghế: {r.memberCount}/{r.maxPlayers}
                    {r.options && 'roundsMode' in r.options
                      ? ` · Chế độ: ${r.options.roundsMode === '500' ? 'Đua 500đ' : '1 ván'}`
                      : ''}
                    {r.options && 'turnTimerSec' in r.options
                      ? ` · ${String(r.options.turnTimerSec)}s/lượt`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => joinRoomByCode(r.code)}
                  className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Tham gia
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
