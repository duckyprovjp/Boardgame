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
    <div className="space-y-4">
      {/* Status & Deck */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="space-y-1 text-xs">
          <p className="text-sm font-semibold text-white">
            Nọc bài còn: <span className="text-emerald-300">{view.deckCount} lá</span>
          </p>
          <p className="text-slate-300">Số lượt phải rút: {view.turnsRemaining}</p>
          {view.topDiscard && (
            <p className="text-slate-400">
              Lá bỏ gần nhất: {MEO_NO_CARDS[view.topDiscard.kind].emoji}{' '}
              {MEO_NO_CARDS[view.topDiscard.kind].name}
            </p>
          )}
        </div>

        {canDraw && (
          <button
            type="button"
            onClick={() => onAction({ type: 'DRAW_CARD' })}
            className="rounded-xl bg-rose-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-400"
          >
            Rút bài kết thúc lượt
          </button>
        )}
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

      {/* Hand */}
      <div>
        <p className="mb-2 text-xs text-slate-400">Bài của bạn ({view.myHand.length} lá)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {view.myHand.map((card) => {
            const meta = MEO_NO_CARDS[card.kind];
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(card)}
                className="flex flex-col items-start rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-left transition hover:border-emerald-400"
              >
                <span className="text-xl">{meta.emoji}</span>
                <span className="mt-1 text-xs font-bold text-white">{meta.name}</span>
                <span className="mt-0.5 text-[10px] leading-tight text-slate-400">
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
