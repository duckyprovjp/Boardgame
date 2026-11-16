'use client';

import {
  formatPlayingCard,
  type BlackjackAction,
  type BlackjackPlayerStatus,
  type BlackjackPlayerView,
} from '@boardgame/shared';

interface BlackjackBoardProps {
  view: BlackjackPlayerView;
  onAction: (action: BlackjackAction) => void;
}

const STATUS_LABELS: Record<BlackjackPlayerStatus, string> = {
  playing: 'Đang chơi',
  stood: 'Đã dừng',
  busted: 'Quắc (>21)',
  blackjack: 'Xì Dách!',
  five_card: 'Ngũ Linh!',
};

export function BlackjackBoard({ view, onAction }: BlackjackBoardProps) {
  const isMyTurn = view.currentTurnPlayerId === view.myPlayerId && !view.isGameOver;
  const canHit = view.legalActions.some((a) => a.type === 'HIT');
  const canStand = view.legalActions.some((a) => a.type === 'STAND');

  return (
    <div className="space-y-4">
      {/* Players hands overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {view.players.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center"
          >
            <p className="text-xs font-semibold text-white">{p.username}</p>
            <p className="mt-1 text-[11px] text-amber-300">{STATUS_LABELS[p.status]}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {p.revealedHand
                ? p.revealedHand.map((c, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-slate-900"
                    >
                      {formatPlayingCard(c)}
                    </span>
                  ))
                : Array.from({ length: p.cardCount }).map((_, idx) => (
                    <span key={idx} className="text-lg">
                      🂠
                    </span>
                  ))}
            </div>
            {p.revealedScore !== null && (
              <p className="mt-1.5 text-xs font-bold text-emerald-300">
                Điểm: {p.revealedScore}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* My hand & controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div>
          <p className="mb-1.5 text-xs text-slate-400">
            Bài của bạn — Tổng điểm:{' '}
            <span
              className={`font-bold ${view.myScore > 21 ? 'text-rose-400' : 'text-emerald-300'}`}
            >
              {view.myScore}
            </span>
            {isMyTurn ? ' · ĐẾN LƯỢT BẠN' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {view.myHand.map((c, idx) => (
              <div
                key={idx}
                className="flex h-16 w-12 items-center justify-center rounded-xl border-2 border-emerald-400 bg-white text-base font-bold text-slate-900"
              >
                {formatPlayingCard(c)}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canHit && (
            <button
              type="button"
              onClick={() => onAction({ type: 'HIT' })}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Rút bài (Hit)
            </button>
          )}
          {canStand && (
            <button
              type="button"
              onClick={() => onAction({ type: 'STAND' })}
              className="rounded-xl border border-slate-600 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Dừng (Stand)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
