'use client';

import {
  formatPlayingCard,
  type HighCardAction,
  type HighCardPlayerView,
} from '@boardgame/shared';

interface HighCardBoardProps {
  view: HighCardPlayerView;
  onAction: (action: HighCardAction) => void;
}

export function HighCardBoard({ view, onAction }: HighCardBoardProps) {
  const isMyTurn = view.currentTurnPlayerId === view.myPlayerId && !view.isGameOver;
  const canSwap = view.legalActions.some((a) => a.type === 'SWAP_CARD');
  const canPlay = view.legalActions.some((a) => a.type === 'PLAY_CARD');

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Bài đã lật trên bàn
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {view.players.map((p) => (
            <div
              key={p.id}
              className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 p-3"
            >
              <span className="text-xs text-slate-400">{p.username}</span>
              <span className="mt-1 text-2xl font-bold text-white">
                {p.playedCard ? formatPlayingCard(p.playedCard) : '🂠'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <p className="text-xs text-slate-400">Bài trên tay của bạn</p>
          <p className="mt-1 text-3xl font-bold text-emerald-300">
            {view.myHand ? formatPlayingCard(view.myHand) : 'Đã đánh'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canSwap && (
            <button
              type="button"
              onClick={() => onAction({ type: 'SWAP_CARD' })}
              className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
            >
              Đổi bài (1 lần)
            </button>
          )}
          {canPlay && (
            <button
              type="button"
              onClick={() => onAction({ type: 'PLAY_CARD' })}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Lật bài
            </button>
          )}
          {!isMyTurn && !view.isGameOver && (
            <span className="text-xs text-slate-400">Đang chờ người chơi khác...</span>
          )}
        </div>
      </div>
    </div>
  );
}
