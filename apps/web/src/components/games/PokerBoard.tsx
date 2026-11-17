'use client';

import type { PokerAction, PokerPlayerView } from '@boardgame/shared';
import { PlayingCardTile } from './PlayingCardTile';

interface PokerBoardProps {
  view: PokerPlayerView;
  onAction: (action: PokerAction) => void;
}

export function PokerBoard({ view, onAction }: PokerBoardProps) {
  const isMyTurn = view.currentTurnPlayerId === view.myPlayerId && !view.isGameOver;
  const canCheck = view.legalActions.some((a) => a.type === 'CHECK');
  const canCall = view.legalActions.some((a) => a.type === 'CALL');
  const raiseAction = view.legalActions.find(
    (a): a is Extract<PokerAction, { type: 'RAISE' }> => a.type === 'RAISE',
  );
  const canAllIn = view.legalActions.some((a) => a.type === 'ALL_IN');
  const canFold = view.legalActions.some((a) => a.type === 'FOLD');

  return (
    <div className="space-y-4">
      {/* Pot & Community Cards */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-emerald-300">
            Ván #{view.handNumber} · Vòng: {view.street.toUpperCase()}
          </span>
          <span className="rounded-lg bg-amber-500/20 px-3 py-1 font-mono font-bold text-amber-300">
            Pot: {view.pot} chip (Cược hiện tại: {view.currentBet})
          </span>
        </div>

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {[0, 1, 2, 3, 4].map((slot) => {
            const card = view.communityCards[slot];
            return card ? (
              <PlayingCardTile key={slot} card={card} />
            ) : (
              <div
                key={slot}
                className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50 text-lg font-bold text-slate-600 sm:h-24 sm:w-16"
              >
                ?
              </div>
            );
          })}
        </div>

        {view.lastShowdownText && (
          <p className="mt-3 text-center text-xs text-amber-200">{view.lastShowdownText}</p>
        )}
      </div>

      {/* My Hole Cards & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div>
          <p className="mb-1.5 text-xs text-slate-400">
            2 lá tẩy của bạn{isMyTurn ? ' — ĐẾN LƯỢT BẠN' : ''}
          </p>
          <div className="flex items-end -space-x-2 pt-4">
            {view.myHoleCards.map((c, idx) => (
              <PlayingCardTile key={idx} card={c} highlighted={isMyTurn} />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canCheck && (
            <button
              type="button"
              onClick={() => onAction({ type: 'CHECK' })}
              className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"
            >
              Xem (Check)
            </button>
          )}
          {canCall && (
            <button
              type="button"
              onClick={() => onAction({ type: 'CALL' })}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Theo (Call)
            </button>
          )}
          {raiseAction && (
            <button
              type="button"
              onClick={() => onAction(raiseAction)}
              className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300"
            >
              Tố ({raiseAction.amount})
            </button>
          )}
          {canAllIn && (
            <button
              type="button"
              onClick={() => onAction({ type: 'ALL_IN' })}
              className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400"
            >
              Tất tay (All-in)
            </button>
          )}
          {canFold && (
            <button
              type="button"
              onClick={() => onAction({ type: 'FOLD' })}
              className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Úp bài (Fold)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
