'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getAvatarById, type GameActionLogEntry, type GameResult } from '@boardgame/shared';

export interface TableSeat {
  id: string;
  username: string;
  avatarId: string;
  level: number;
  isCurrentTurn: boolean;
  eliminated?: boolean;
  away?: boolean;
  cardCount?: number;
  badge?: string;
  sublabel?: string;
}

interface TableShellProps {
  title: string;
  roomCode: string;
  seats: TableSeat[];
  myPlayerId: string;
  turnEndsAt: number | null;
  actionLog: GameActionLogEntry[];
  isGameOver: boolean;
  result: GameResult | null;
  isHost: boolean;
  tableThemeClass?: string;
  onReturnLobby: () => void;
  onLeaveRoom: () => void;
  children: ReactNode;
}

/**
 * Computes percentage (x%, y%) coordinates on an ellipse, placing hero at bottom-left (16%, 86%)
 * so the bottom-center area remains clear for the fanned card hand.
 */
export function getEllipseSeatCoords(
  indexInOrder: number,
  totalSeats: number,
): { leftPct: number; topPct: number } {
  if (indexInOrder === 0) {
    return { leftPct: 16, topPct: 86 };
  }
  const oppCount = Math.max(1, totalSeats - 1);
  // Distribute opponents along the upper arc from left (195 deg) through top (270 deg) to right (345 deg)
  const startDeg = 190;
  const endDeg = 350;
  const t = oppCount === 1 ? 0.5 : (indexInOrder - 1) / (oppCount - 1);
  const angleRad = ((startDeg + t * (endDeg - startDeg)) * Math.PI) / 180;
  const rx = 41;
  const ry = 37;
  return {
    leftPct: 50 + rx * Math.cos(angleRad),
    topPct: 49 + ry * Math.sin(angleRad),
  };
}

export function TableShell({
  title,
  roomCode,
  seats,
  myPlayerId,
  turnEndsAt,
  actionLog,
  isGameOver,
  result,
  isHost,
  tableThemeClass = 'bg-[radial-gradient(circle_at_center,#1e293b_0%,#0f172a_65%,#020617_100%)]',
  onReturnLobby,
  onLeaveRoom,
  children,
}: TableShellProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (!turnEndsAt || isGameOver) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  }, [turnEndsAt, isGameOver]);

  // Rotate seats so hero (myPlayerId) is at index 0 (bottom-center)
  const heroIdx = Math.max(
    0,
    seats.findIndex((s) => s.id === myPlayerId),
  );
  const orderedSeats = [...seats.slice(heroIdx), ...seats.slice(0, heroIdx)];

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col justify-between gap-2 px-2 py-2 sm:px-4 sm:py-3">
      {/* Top HUD Bar */}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white">{title}</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-amber-300">
            #{roomCode}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {secondsLeft !== null && (
            <span
              className={`rounded-lg px-2.5 py-1 font-mono font-bold ${
                secondsLeft <= 5
                  ? 'animate-pulse bg-rose-500/25 text-rose-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {secondsLeft}s
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowLog((prev) => !prev)}
            className="cursor-pointer rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:bg-slate-800"
          >
            {showLog ? 'Ẩn nhật ký' : `Nhật ký (${actionLog.length})`}
          </button>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="cursor-pointer rounded-lg border border-rose-500/40 px-2.5 py-1 text-rose-300 hover:bg-rose-500/10"
          >
            Rời bàn
          </button>
        </div>
      </div>

      {/* Responsive CSS aspect-ratio Ellipse Table */}
      <div className="relative mx-auto w-full max-w-6xl flex-1">
        <div
          className={`relative mx-auto min-h-[480px] w-full overflow-hidden rounded-[2.5rem] border-4 border-stone-800/90 shadow-2xl sm:aspect-[16/10] ${tableThemeClass}`}
        >
          {/* Inner table felt ring */}
          <div className="pointer-events-none absolute inset-[10%] rounded-[999px] border border-white/10" />

          {/* Positioned Seats on Ellipse */}
          {orderedSeats.map((seat, idx) => {
            const coords = getEllipseSeatCoords(idx, orderedSeats.length);
            const av = getAvatarById(seat.avatarId);
            const isHero = idx === 0;
            return (
              <div
                key={seat.id}
                style={{
                  left: `${coords.leftPct}%`,
                  top: `${coords.topPct}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute z-20 flex flex-col items-center ${
                  seat.eliminated ? 'opacity-45 grayscale' : ''
                }`}
              >
                {/* Mini fanned face-down cards for opponents */}
                {!isHero && typeof seat.cardCount === 'number' && seat.cardCount > 0 && (
                  <div className="mb-1 flex items-end -space-x-2.5">
                    {Array.from({ length: Math.min(7, seat.cardCount) }).map((_, ci, arr) => {
                      const mid = (arr.length - 1) / 2;
                      const deg = (ci - mid) * 6;
                      return (
                        <div
                          key={ci}
                          style={{ transform: `rotate(${deg}deg)` }}
                          className="h-7 w-5 rounded border border-white/50 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-md"
                        />
                      );
                    })}
                  </div>
                )}

                <div
                  className={`flex items-center gap-1.5 rounded-2xl border px-2.5 py-1.5 backdrop-blur transition ${
                    seat.isCurrentTurn
                      ? 'border-amber-400 bg-slate-950/90 ring-2 ring-amber-400/60'
                      : 'border-white/15 bg-slate-950/75'
                  }`}
                >
                  <span className="text-lg leading-none">{av.emoji}</span>
                  <div className="max-w-[96px] text-left">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[11px] font-bold text-white">
                        {seat.username}
                      </span>
                      <span className="rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-300">
                        Lv.{seat.level}
                      </span>
                    </div>
                    {seat.sublabel && (
                      <p className="truncate text-[10px] text-slate-300">{seat.sublabel}</p>
                    )}
                  </div>
                  {typeof seat.cardCount === 'number' && (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                      {seat.cardCount}
                    </span>
                  )}
                </div>

                {seat.badge && (
                  <span className="mt-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">
                    {seat.badge}
                  </span>
                )}
                {seat.away && (
                  <span className="mt-0.5 rounded bg-rose-500/80 px-1.5 py-0.5 text-[9px] text-white">
                    Mất kết nối
                  </span>
                )}
              </div>
            );
          })}

          {/* Center & Action Area Slot */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4">
            {children}
          </div>

          {/* Collapsible Game Log */}
          {showLog && (
            <div className="absolute right-3 top-3 z-30 max-h-60 w-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-[11px] text-slate-200 shadow-xl">
              <p className="mb-1.5 font-bold text-amber-300">Nhật ký ván đấu</p>
              <div className="space-y-1">
                {actionLog.slice(-20).map((entry) => (
                  <div key={entry.id}>• {entry.text}</div>
                ))}
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {isGameOver && result && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-500/40 bg-slate-900 p-6 text-center shadow-2xl">
                <h2 className="text-2xl font-extrabold text-amber-300">Trận đấu kết thúc!</h2>
                <div className="space-y-1.5 text-left text-xs">
                  {result.rankings.map((r) => {
                    const seat = seats.find((s) => s.id === r.playerId);
                    return (
                      <div
                        key={r.playerId}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                      >
                        <span className="font-semibold text-white">
                          #{r.rank} — {seat?.username ?? r.playerId}
                        </span>
                        {r.score !== undefined && (
                          <span className="text-emerald-300">Điểm: {r.score}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {isHost ? (
                  <button
                    type="button"
                    onClick={onReturnLobby}
                    className="w-full cursor-pointer rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    Quay lại phòng chờ
                  </button>
                ) : (
                  <p className="text-xs text-slate-400">Đang chờ chủ phòng quay lại phòng chờ...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
