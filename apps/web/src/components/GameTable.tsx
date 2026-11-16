'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { getAvatarById, type GameActionLogEntry, type GameResult } from '@boardgame/shared';

export interface GameTableSeat {
  id: string;
  username: string;
  avatarId: string;
  isCurrentTurn: boolean;
  badge?: string;
  sublabel?: string;
}

interface GameTableProps {
  title: string;
  roomCode: string;
  seats: GameTableSeat[];
  myPlayerId: string;
  turnEndsAt: number | null;
  actionLog: GameActionLogEntry[];
  isGameOver: boolean;
  result: GameResult | null;
  isHost: boolean;
  onReturnLobby: () => void;
  onLeaveRoom: () => void;
  children: ReactNode;
}

export function GameTable({
  title,
  roomCode,
  seats,
  myPlayerId,
  turnEndsAt,
  actionLog,
  isGameOver,
  result,
  isHost,
  onReturnLobby,
  onLeaveRoom,
  children,
}: GameTableProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!turnEndsAt || isGameOver) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [turnEndsAt, isGameOver]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>
          <p className="text-xs text-slate-400">Mã phòng: {roomCode}</p>
        </div>

        <div className="flex items-center gap-3">
          {secondsLeft !== null && (
            <span
              className={`rounded-lg px-3 py-1 font-mono text-xs font-bold ${
                secondsLeft <= 5
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              ⏱ {secondsLeft}s
            </span>
          )}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            Rời bàn
          </button>
        </div>
      </div>

      {/* Player seats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {seats.map((seat) => {
          const av = getAvatarById(seat.avatarId);
          return (
            <div
              key={seat.id}
              className={`rounded-xl border p-2.5 transition ${
                seat.isCurrentTurn
                  ? 'border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/40'
                  : 'border-slate-800 bg-slate-950/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{av.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    {seat.username}
                    {seat.id === myPlayerId ? ' (Bạn)' : ''}
                  </p>
                  {seat.sublabel && <p className="text-[11px] text-slate-400">{seat.sublabel}</p>}
                </div>
              </div>
              {seat.badge && (
                <span className="mt-1.5 inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-emerald-300">
                  {seat.badge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Main game board / hand area */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">{children}</div>

      {/* Game Over panel */}
      {isGameOver && result && (
        <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <h4 className="text-base font-bold text-emerald-300">Trận đấu kết thúc!</h4>
          <div className="space-y-1 text-xs text-slate-200">
            {result.rankings.map((r) => {
              const seat = seats.find((s) => s.id === r.playerId);
              return (
                <div key={r.playerId} className="flex items-center justify-between">
                  <span>
                    #{r.rank} — {seat?.username ?? r.playerId}
                  </span>
                  {r.score !== undefined && <span className="text-slate-400">Điểm: {r.score}</span>}
                </div>
              );
            })}
          </div>
          {isHost ? (
            <button
              type="button"
              onClick={onReturnLobby}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Quay lại sảnh chờ
            </button>
          ) : (
            <p className="text-xs text-slate-400">Đang chờ chủ phòng quay lại sảnh chờ...</p>
          )}
        </div>
      )}

      {/* Action log */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Nhật ký trận đấu
        </p>
        <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-slate-300">
          {actionLog.map((entry) => (
            <div key={entry.id}>• {entry.text}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
