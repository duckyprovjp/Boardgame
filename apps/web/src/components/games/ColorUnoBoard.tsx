'use client';

import { useState } from 'react';
import {
  UNO_COLORS,
  UNO_COLOR_LABELS,
  formatUnoCardLabel,
  type ColorUnoAction,
  type ColorUnoPlayerView,
  type UnoCard,
  type UnoColor,
} from '@boardgame/shared';

interface ColorUnoBoardProps {
  view: ColorUnoPlayerView;
  onAction: (action: ColorUnoAction) => void;
}

const COLOR_STYLES: Record<UnoColor | 'wild', string> = {
  red: 'bg-rose-600 border-rose-300 text-white',
  blue: 'bg-sky-600 border-sky-300 text-white',
  green: 'bg-emerald-600 border-emerald-300 text-white',
  yellow: 'bg-amber-400 border-amber-200 text-slate-950',
  wild: 'bg-gradient-to-br from-rose-500 via-amber-400 to-sky-500 border-white text-slate-950',
};

const ACTIVE_COLOR_BADGE: Record<UnoColor, string> = {
  red: 'bg-rose-500 text-white',
  blue: 'bg-sky-500 text-white',
  green: 'bg-emerald-500 text-slate-950',
  yellow: 'bg-amber-400 text-slate-950',
};

export function ColorUnoBoard({ view, onAction }: ColorUnoBoardProps) {
  const [pendingWildCard, setPendingWildCard] = useState<UnoCard | null>(null);

  const canDraw = view.legalActions.some((a) => a.type === 'DRAW_CARD');
  const canPass = view.legalActions.some((a) => a.type === 'PASS_TURN');
  const canCallLast = view.legalActions.some((a) => a.type === 'CALL_LAST_CARD');
  const canChallenge = view.legalActions.some((a) => a.type === 'CHALLENGE_WD4');
  const canDecline = view.legalActions.some((a) => a.type === 'DECLINE_WD4');
  const catchActions = view.legalActions.filter(
    (a): a is Extract<ColorUnoAction, { type: 'CATCH_LAST_CARD' }> => a.type === 'CATCH_LAST_CARD',
  );

  const isCardPlayable = (cardId: string) =>
    view.legalActions.some((a) => a.type === 'PLAY_CARD' && a.cardId === cardId);

  const handleCardClick = (card: UnoCard) => {
    if (!isCardPlayable(card.id)) return;
    if (card.color === 'wild') {
      setPendingWildCard(card);
    } else {
      onAction({ type: 'PLAY_CARD', cardId: card.id });
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-between py-14 sm:py-16">
      {/* Center Piles: Draw pile upper-left + Discard pile center */}
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          disabled={!canDraw}
          onClick={() => onAction({ type: 'DRAW_CARD' })}
          className={`flex h-24 w-16 flex-col items-center justify-center rounded-xl border-2 border-white/40 bg-slate-950/90 text-xs font-bold text-white shadow-xl transition ${
            canDraw ? 'cursor-pointer ring-2 ring-amber-400 hover:-translate-y-1' : 'opacity-70'
          }`}
        >
          <span>NỌC</span>
          <span className="mt-1 text-amber-300">{view.deckCount}</span>
        </button>

        {/* Rotated Discard Pile */}
        <div className="relative h-24 w-16">
          {(view.recentDiscard ?? [view.topCard]).map((card, i, arr) => {
            const rot = i === arr.length - 1 ? 'rotate-[4deg]' : 'rotate-[-8deg] opacity-80';
            return (
              <div
                key={card.id}
                className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 p-1.5 text-center text-xs font-black shadow-2xl ${rot} ${
                  COLOR_STYLES[card.color]
                }`}
              >
                {formatUnoCardLabel(card)}
              </div>
            );
          })}
        </div>

        <div className="space-y-1 text-left text-[11px]">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 font-bold shadow ${
              ACTIVE_COLOR_BADGE[view.activeColor]
            }`}
          >
            {UNO_COLOR_LABELS[view.activeColor]}
          </span>
          <p className="text-white/90">{view.direction === 1 ? '↻ Thuận' : '↺ Ngược'}</p>
          {view.roundsMode === '500' && <p className="text-amber-200">Ván #{view.roundNumber}</p>}
        </div>
      </div>

      {/* Center WD4 Challenge Prompt */}
      {view.phase === 'wd4_challenge' && view.wd4Prompt && (canChallenge || canDecline) && (
        <div className="z-30 rounded-2xl border border-amber-400 bg-slate-950/95 p-4 text-center shadow-2xl">
          <p className="mb-3 text-xs font-semibold text-white">
            <strong>{view.wd4Prompt.offenderUsername}</strong> vừa đánh lá Đổi Màu +4 nhắm vào bạn!
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onAction({ type: 'CHALLENGE_WD4' })}
              className="cursor-pointer rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-400"
            >
              Thách đấu
            </button>
            <button
              type="button"
              onClick={() => onAction({ type: 'DECLINE_WD4' })}
              className="cursor-pointer rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Từ chối (Rút 4)
            </button>
          </div>
        </div>
      )}

      {/* Wild color picker */}
      {pendingWildCard && (
        <div className="z-30 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400 bg-slate-950/95 px-4 py-2.5 shadow-xl">
          <span className="text-xs font-semibold text-amber-300">Chọn màu:</span>
          {UNO_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                onAction({ type: 'PLAY_CARD', cardId: pendingWildCard.id, chosenColor: color });
                setPendingWildCard(null);
              }}
              className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-bold ${ACTIVE_COLOR_BADGE[color]}`}
            >
              {UNO_COLOR_LABELS[color]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPendingWildCard(null)}
            className="cursor-pointer rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300"
          >
            Huỷ
          </button>
        </div>
      )}

      {/* Action buttons + Fanned Hero Hand at bottom */}
      <div className="flex w-full flex-col items-center gap-2 px-4 pb-8">
        <div className="flex flex-wrap justify-center gap-2">
          {canPass && (
            <button
              type="button"
              onClick={() => onAction({ type: 'PASS_TURN' })}
              className="cursor-pointer rounded-xl bg-slate-950/90 px-4 py-1.5 text-xs font-bold text-white ring-1 ring-white/30 hover:bg-slate-900"
            >
              Bỏ qua lượt
            </button>
          )}
          {canCallLast && (
            <button
              type="button"
              onClick={() => onAction({ type: 'CALL_LAST_CARD' })}
              className="animate-pulse cursor-pointer rounded-xl bg-amber-400 px-4 py-1.5 text-xs font-black text-slate-950 shadow-lg"
            >
              CÒN 1 LÁ!
            </button>
          )}
          {catchActions.map((ca) => {
            const target = view.players.find((p) => p.id === ca.targetId);
            return (
              <button
                key={ca.targetId}
                type="button"
                onClick={() => onAction(ca)}
                className="cursor-pointer rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg"
              >
                Bắt lỗi {target?.username}!
              </button>
            );
          })}
        </div>

        {/* Fanned Hand */}
        <div className="flex max-w-full flex-wrap items-end justify-center gap-y-2 pt-6 -space-x-3 sm:-space-x-2">
          {view.myHand.map((card) => {
            const playable = isCardPlayable(card.id);
            const label = formatUnoCardLabel(card);
            return (
              <button
                key={card.id}
                type="button"
                aria-disabled={!playable}
                title={label}
                onClick={() => handleCardClick(card)}
                className={`relative flex h-24 w-16 flex-col items-center justify-center rounded-xl border-2 p-1.5 text-center text-xs font-black shadow-lg transition-all duration-150 ease-out sm:h-28 sm:w-[4.5rem] hover:z-30 hover:scale-105 hover:shadow-2xl ${
                  COLOR_STYLES[card.color]
                } ${
                  playable
                    ? '-translate-y-1.5 cursor-pointer ring-2 ring-white hover:-translate-y-6 hover:ring-amber-300'
                    : 'cursor-default opacity-70 brightness-90 hover:-translate-y-4 hover:opacity-100 hover:brightness-100 hover:ring-2 hover:ring-white/60'
                }`}
              >
                <span className="pointer-events-none rounded-lg border border-white/25 bg-black/10 px-1 py-2 leading-tight">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
