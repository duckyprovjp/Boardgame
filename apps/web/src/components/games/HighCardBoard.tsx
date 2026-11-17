'use client';

import type { HighCardAction, HighCardPlayerView } from '@boardgame/shared';
import { PlayingCardTile } from './PlayingCardTile';

interface HighCardBoardProps {
  view: HighCardPlayerView;
  onAction: (action: HighCardAction) => void;
}

export function HighCardBoard({ view, onAction }: HighCardBoardProps) {
  const isMyTurn = view.currentTurnPlayerId === view.myPlayerId && !view.isGameOver;
  const canSwap = view.legalActions.some((a) => a.type === 'SWAP_CARD');
  const canPlay = view.legalActions.some((a) => a.type === 'PLAY_CARD');

  return (
    <div className="flex h-full w-full flex-col items-center justify-between gap-4 py-12 sm:py-14">
      <div className="text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
          Bài đã lật trên bàn
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {view.players.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-1.5">
              {p.playedCard ? (
                <PlayingCardTile card={p.playedCard} size="sm" />
              ) : (
                <PlayingCardTile faceDown size="sm" />
              )}
              <span className="text-[11px] font-medium text-slate-300">{p.username}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-3 px-4 pb-2">
        <div className="flex flex-wrap justify-center gap-2">
          {canSwap && (
            <button
              type="button"
              onClick={() => onAction({ type: 'SWAP_CARD' })}
              className="cursor-pointer rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
            >
              Đổi bài (1 lần)
            </button>
          )}
          {canPlay && (
            <button
              type="button"
              onClick={() => onAction({ type: 'PLAY_CARD' })}
              className="cursor-pointer rounded-xl bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Lật bài
            </button>
          )}
          {!isMyTurn && !view.isGameOver && (
            <span className="text-xs text-slate-400">Đang chờ người chơi khác...</span>
          )}
        </div>

        <div className="pt-4">
          {view.myHand ? (
            <PlayingCardTile card={view.myHand} highlighted={canPlay} />
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs text-slate-400">
              Đã đánh
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
