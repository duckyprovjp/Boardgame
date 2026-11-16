'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  GAME_CATALOG,
  SOCKET_EVENTS,
  getGameCatalogItem,
  type GameId,
  type RoomState,
  type RoomVisibility,
} from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';

export default function CreateRoomPage() {
  const params = useParams<{ game: string }>();
  const router = useRouter();
  const { user, loadingAuth, socket, setRoom } = useApp();

  const gameId = (
    GAME_CATALOG.some((g) => g.id === params.game) ? params.game : 'color-uno'
  ) as GameId;
  const game = getGameCatalogItem(gameId);

  const [maxPlayers, setMaxPlayers] = useState(Math.min(4, game.maxPlayers));
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [turnTimerSec, setTurnTimerSec] = useState(20);
  const [roundsMode, setRoundsMode] = useState<'single' | '500'>('single');
  const [stackDrawCards, setStackDrawCards] = useState(false);
  const [forcedPlayAfterDraw, setForcedPlayAfterDraw] = useState(false);
  const [reactionWindowMs, setReactionWindowMs] = useState(5000);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loadingAuth || !user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-slate-400">
        Đang tải biểu mẫu tạo phòng...
      </main>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    setError(null);
    setSubmitting(true);

    const options =
      gameId === 'color-uno'
        ? { roundsMode, turnTimerSec, stackDrawCards, forcedPlayAfterDraw }
        : gameId === 'dice-fate'
          ? { turnTimerSec, reactionWindowMs }
          : { turnTimerSec };

    socket.emit(
      SOCKET_EVENTS.ROOM_CREATE,
      { gameId, maxPlayers, visibility, options },
      (res: { ok: boolean; error?: string; room?: RoomState }) => {
        setSubmitting(false);
        if (!res.ok || !res.room) {
          setError(res.error ?? 'Không thể tạo phòng');
          return;
        }
        setRoom(res.room);
        router.push(`/rooms/${res.room.code}`);
      },
    );
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href={`/games/${gameId}`} className="text-xs text-slate-400 hover:text-amber-300">
        ← Quay lại sảnh {game.name}
      </Link>

      <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <h1 className="text-xl font-bold text-white">Tạo phòng: {game.name}</h1>
        <p className="mt-1 text-xs text-slate-400">Tuỳ chỉnh luật bàn chơi trước khi mời bạn</p>

        {error && (
          <div className="my-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Số người tối đa ({game.minPlayers}–{game.maxPlayers})
              </label>
              <input
                type="number"
                min={game.minPlayers}
                max={game.maxPlayers}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Chế độ phòng</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as RoomVisibility)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="public">Công khai</option>
                <option value="private">Riêng tư (chỉ mã phòng)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Thời gian mỗi lượt (10–60 giây)
            </label>
            <input
              type="number"
              min={10}
              max={60}
              value={turnTimerSec}
              onChange={(e) => setTurnTimerSec(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          {gameId === 'color-uno' && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Tuỳ chọn Bài Sắc Màu
              </p>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Chế độ tính thắng</label>
                <select
                  value={roundsMode}
                  onChange={(e) => setRoundsMode(e.target.value as 'single' | '500')}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="single">1 ván duy nhất</option>
                  <option value="500">Đua tới 500 điểm</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={stackDrawCards}
                  onChange={(e) => setStackDrawCards(e.target.checked)}
                />
                Cho phép cộng dồn lá +2 / +4
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={forcedPlayAfterDraw}
                  onChange={(e) => setForcedPlayAfterDraw(e.target.checked)}
                />
                Bắt buộc đánh ngay nếu lá vừa rút đánh được
              </label>
            </div>
          )}

          {gameId === 'dice-fate' && (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Tuỳ chọn Xúc Xắc Định Mệnh
              </p>
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Cửa sổ phản ứng (ms, mặc định 5000ms)
                </label>
                <input
                  type="number"
                  min={3000}
                  max={15000}
                  step={500}
                  value={reactionWindowMs}
                  onChange={(e) => setReactionWindowMs(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? 'Đang tạo phòng...' : 'Tạo phòng ngay'}
          </button>
        </form>
      </section>
    </main>
  );
}
