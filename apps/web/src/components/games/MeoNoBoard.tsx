'use client';

import { useState } from 'react';
import {
  MEO_NO_CARDS,
  type MeoNoAction,
  type MeoNoCard,
  type MeoNoPlayerView,
} from '@boardgame/shared';

interface MeoNoBoardProps {
  view: MeoNoPlayerView;
  onAction: (action: MeoNoAction) => void;
}

export function MeoNoBoard({ view, onAction }: MeoNoBoardProps) {
  const [bombPos, setBombPos] = useState(0);
  const [pendingTargetCard, setPendingTargetCard] = useState<MeoNoCard | null>(null);

  const isMyTurn = view.activeTurnPlayerId === view.myPlayerId && view.phase === 'playing';
  const canDraw = view.legalActions.some((a) => a.type === 'DRAW_CARD');
  const canPassNope = view.legalActions.some((a) => a.type === 'PASS_NOPE');
  const nopeCardAction = view.legalActions.find(
    (a): a is Extract<MeoNoAction, { type: 'PLAY_NOPE' }> => a.type === 'PLAY_NOPE',
  );
  const isDefusingMe = view.phase === 'defuse_pending' && view.defusingPlayerId === view.myPlayerId;
  const isFavorTargetMe = view.phase === 'favor_pending' && view.favorTargetId === view.myPlayerId;

  const otherAliveWithCards = view.players.filter(
    (p) => p.id !== view.myPlayerId && p.alive && p.cardCount > 0,
  );

  const isCardPlayable = (card: MeoNoCard): boolean => {
    if (isFavorTargetMe) return true;
    if (view.phase === 'nope_window' && card.kind === 'nope' && Boolean(nopeCardAction)) {
      return true;
    }
    if (!isMyTurn) return false;
    if (card.kind === 'favor' && otherAliveWithCards.length > 0) return true;
    if (view.legalActions.some((a) => a.type === 'PLAY_CARD' && a.cardId === card.id)) return true;
    if (
      (card.kind === 'combo_watermelon' ||
        card.kind === 'combo_potato' ||
        card.kind === 'combo_rainbow') &&
      view.legalActions.some((a) => a.type === 'PLAY_PAIR' && a.cardKind === card.kind)
    ) {
      return true;
    }
    return false;
  };

  const handleCardClick = (card: MeoNoCard) => {
    if (isFavorTargetMe) {
      onAction({ type: 'GIVE_FAVOR', cardId: card.id });
      return;
    }

    if (view.phase === 'nope_window' && card.kind === 'nope' && nopeCardAction) {
      onAction({ type: 'PLAY_NOPE', cardId: card.id });
      return;
    }

    if (!isMyTurn) return;

    if (card.kind === 'favor') {
      if (otherAliveWithCards.length === 1) {
        onAction({ type: 'PLAY_CARD', cardId: card.id, targetId: otherAliveWithCards[0]!.id });
      } else if (otherAliveWithCards.length > 1) {
        setPendingTargetCard(card);
      }
      return;
    }

    const directPlay = view.legalActions.find(
      (a) => a.type === 'PLAY_CARD' && a.cardId === card.id,
    );
    if (directPlay) {
      onAction(directPlay);
      return;
    }

    if (
      card.kind === 'combo_watermelon' ||
      card.kind === 'combo_potato' ||
      card.kind === 'combo_rainbow'
    ) {
      const pairAction = view.legalActions.find(
        (a): a is Extract<MeoNoAction, { type: 'PLAY_PAIR' }> =>
          a.type === 'PLAY_PAIR' && a.cardKind === card.kind,
      );
      if (pairAction) {
        if (otherAliveWithCards.length === 1) {
          onAction(pairAction);
        } else {
          setPendingTargetCard(card);
        }
      }
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-between gap-4 py-4">
      {/* Center Piles: Deck + Discard + Status */}
      <div className="flex flex-wrap items-center justify-center gap-6">
        <button
          type="button"
          disabled={!canDraw}
          onClick={() => onAction({ type: 'DRAW_CARD' })}
          className={`flex h-24 w-16 flex-col items-center justify-center rounded-xl border-2 border-white/40 bg-slate-950/90 text-xs font-bold text-white shadow-xl transition-all duration-150 ${
            canDraw ? 'cursor-pointer ring-2 ring-rose-400 hover:-translate-y-1.5' : 'opacity-75'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider text-slate-300">Nọc</span>
          <span className="mt-1 text-base font-black text-emerald-300">{view.deckCount}</span>
          {canDraw && <span className="mt-1 text-[9px] text-rose-300">Rút bài</span>}
        </button>

        {view.topDiscard ? (
          <div className="flex h-24 w-16 rotate-[4deg] flex-col items-center justify-center rounded-xl border-2 border-amber-300/60 bg-slate-900 p-1.5 text-center shadow-2xl">
            <span className="text-xl">{MEO_NO_CARDS[view.topDiscard.kind].emoji}</span>
            <span className="mt-1 line-clamp-2 text-[10px] font-bold leading-tight text-white">
              {MEO_NO_CARDS[view.topDiscard.kind].name}
            </span>
          </div>
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/40 text-[10px] text-slate-500">
            Bỏ bài
          </div>
        )}

        <div className="space-y-1 text-left text-xs">
          <p className="font-semibold text-white">
            Lượt phải rút: <span className="text-amber-300">{view.turnsRemaining}</span>
          </p>
          {canDraw && (
            <button
              type="button"
              onClick={() => onAction({ type: 'DRAW_CARD' })}
              className="cursor-pointer rounded-xl bg-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-rose-400"
            >
              Rút bài kết thúc lượt
            </button>
          )}
        </div>
      </div>

      {/* Private See-the-Future peek */}
      {view.peekedTop3 && (
        <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-3">
          <p className="mb-2 text-xs font-semibold text-purple-300">
            🔮 Bí mật 3 lá trên cùng của nọc (chỉ bạn thấy):
          </p>
          <div className="flex flex-wrap gap-2">
            {view.peekedTop3.map((c, idx) => (
              <span
                key={`${c.id}-${idx}`}
                className="rounded-lg border border-purple-400/30 bg-slate-900 px-3 py-1.5 text-xs text-white"
              >
                #{idx + 1}: {MEO_NO_CARDS[c.kind].emoji} {MEO_NO_CARDS[c.kind].name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Nope response window */}
      {view.phase === 'nope_window' && view.pendingAction && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-200">
            Cửa sổ Chặn Đòn (đã chặn: {view.pendingAction.nopeCount} lần)
          </p>
          <div className="flex gap-2">
            {nopeCardAction && (
              <button
                type="button"
                onClick={() => onAction(nopeCardAction)}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400"
              >
                ✋ Đánh Chặn Đòn
              </button>
            )}
            {canPassNope && (
              <button
                type="button"
                onClick={() => onAction({ type: 'PASS_NOPE' })}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                Không chặn
              </button>
            )}
          </div>
        </div>
      )}

      {/* Defuse re-insertion */}
      {isDefusingMe && (
        <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold text-emerald-300">
            🛠️ Bạn đã gỡ Mèo Bom! Chọn vị trí đặt lại vào nọc (0 = trên cùng, {view.deckCount} = dưới
            cùng):
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="range"
              min={0}
              max={view.deckCount}
              value={bombPos}
              onChange={(e) => setBombPos(Number(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono text-xs text-white">Vị trí: {bombPos}</span>
            <button
              type="button"
              onClick={() => onAction({ type: 'DEFUSE_INSERT', position: bombPos })}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950"
            >
              Đặt bom lại
            </button>
          </div>
        </div>
      )}

      {/* Favor give prompt */}
      {isFavorTargetMe && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-200">
          🙏 Bạn bị Xin Xỏ! Hãy bấm vào 1 lá bài trên tay để tặng cho đối thủ.
        </div>
      )}

      {/* Target selector for Favor / Pair */}
      {pendingTargetCard && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-slate-900 p-3">
          <span className="text-xs text-amber-200">
            Chọn mục tiêu cho {MEO_NO_CARDS[pendingTargetCard.kind].name}:
          </span>
          <div className="flex flex-wrap gap-2">
            {otherAliveWithCards.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (pendingTargetCard.kind === 'favor') {
                    onAction({ type: 'PLAY_CARD', cardId: pendingTargetCard.id, targetId: p.id });
                  } else {
                    onAction({
                      type: 'PLAY_PAIR',
                      cardKind: pendingTargetCard.kind as
                        | 'combo_watermelon'
                        | 'combo_potato'
                        | 'combo_rainbow',
                      targetId: p.id,
                    });
                  }
                  setPendingTargetCard(null);
                }}
                className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950"
              >
                {p.username} ({p.cardCount} lá)
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPendingTargetCard(null)}
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Fanned Hand at bottom */}
      <div className="flex w-full flex-col items-center gap-2 px-2 pb-2">
        <p className="text-[11px] font-medium text-slate-300">
          Bài của bạn ({view.myHand.length} lá)
        </p>
        <div className="flex max-w-full flex-wrap items-end justify-center gap-y-2 pt-6 -space-x-3 sm:-space-x-2">
          {view.myHand.map((card) => {
            const meta = MEO_NO_CARDS[card.kind];
            const playable = isCardPlayable(card);
            return (
              <button
                key={card.id}
                type="button"
                aria-disabled={!playable}
                title={`${meta.name}: ${meta.description}`}
                onClick={() => handleCardClick(card)}
                className={`relative flex h-28 w-20 flex-col items-center justify-between rounded-xl border-2 bg-slate-900 p-2 text-center shadow-lg transition-all duration-150 ease-out sm:h-32 sm:w-24 hover:z-30 hover:scale-105 hover:shadow-2xl ${
                  playable
                    ? '-translate-y-1.5 cursor-pointer border-emerald-400 ring-1 ring-emerald-400/50 hover:-translate-y-6 hover:border-amber-300'
                    : 'cursor-default border-slate-600/80 opacity-80 hover:-translate-y-4 hover:border-white/60 hover:opacity-100'
                }`}
              >
                <span className="text-2xl leading-none">{meta.emoji}</span>
                <span className="line-clamp-2 text-[11px] font-bold leading-tight text-white">
                  {meta.name}
                </span>
                <span className="line-clamp-2 text-[9px] leading-tight text-slate-400">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
