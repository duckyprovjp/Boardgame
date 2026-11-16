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
  red: 'bg-rose-600 border-rose-400 text-white',
  blue: 'bg-sky-600 border-sky-400 text-white',
  green: 'bg-emerald-600 border-emerald-400 text-white',
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

  const isMyTurn = view.currentTurnPlayerId === view.myPlayerId && !view.isGameOver;
  const canDraw = view.legalActions.some((a) => a.type === 'DRAW_CARD');
  const canPass = view.legalActions.some((a) => a.type === 'PASS_TURN');
  const canCallLast = view.legalActions.some((a) => a.type === 'CALL_LAST_CARD');
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

  const handlePickColor = (color: UnoColor) => {
    if (!pendingWildCard) return;
    onAction({ type: 'PLAY_CARD', cardId: pendingWildCard.id, chosenColor: color });
    setPendingWildCard(null);
  };

  return (
    <div className="space-y-4">
      {/* Center table */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-24 w-16 flex-col items-center justify-center rounded-xl border-2 p-2 text-center font-bold shadow-lg ${
              COLOR_STYLES[view.topCard.color]
            }`}
          >
            <span className="text-sm leading-tight">{formatUnoCardLabel(view.topCard)}</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Màu hiện tại:</span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-semibold ${
                  ACTIVE_COLOR_BADGE[view.activeColor]
                }`}
              >
                {UNO_COLOR_LABELS[view.activeColor]}
              </span>
            </div>
            <p className="text-slate-300">
              Chiều đánh: {view.direction === 1 ? '↻ Thuận chiều' : '↺ Ngược chiều'}
            </p>
            <p className="text-slate-400">Nọc còn: {view.deckCount} lá</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canDraw && (
            <button
              type="button"
              onClick={() => onAction({ type: 'DRAW_CARD' })}
              className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"
            >
              Rút 1 lá
            </button>
          )}
          {canPass && (
            <button
              type="button"
              onClick={() => onAction({ type: 'PASS_TURN' })}
              className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Bỏ qua lượt
            </button>
          )}
          {canCallLast && (
            <button
              type="button"
              onClick={() => onAction({ type: 'CALL_LAST_CARD' })}
              className="animate-pulse rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
            >
              Hô &quot;CÒN 1 LÁ!&quot;
            </button>
          )}
          {catchActions.map((ca) => {
            const target = view.players.find((p) => p.id === ca.targetId);
            return (
              <button
                key={ca.targetId}
                type="button"
                onClick={() => onAction(ca)}
                className="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-400"
              >
                Bắt lỗi {target?.username ?? 'đối thủ'}!
              </button>
            );
          })}
        </div>
      </div>

      {/* Wild color picker */}
      {pendingWildCard && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/50 bg-slate-900 p-3">
          <span className="text-xs font-semibold text-amber-300">
            Chọn màu cho lá {formatUnoCardLabel(pendingWildCard)}:
          </span>
          <div className="flex flex-wrap gap-2">
            {UNO_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handlePickColor(color)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${ACTIVE_COLOR_BADGE[color]}`}
              >
                {UNO_COLOR_LABELS[color]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPendingWildCard(null)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Player hand */}
      <div>
        <p className="mb-2 text-xs text-slate-400">
          Bài của bạn ({view.myHand.length} lá){isMyTurn ? ' — ĐẾN LƯỢT BẠN' : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          {view.myHand.map((card) => {
            const playable = isCardPlayable(card.id);
            return (
              <button
                key={card.id}
                type="button"
                disabled={!playable}
                onClick={() => handleCardClick(card)}
                className={`flex h-20 w-14 flex-col items-center justify-center rounded-xl border-2 p-1.5 text-center text-xs font-bold transition ${
                  COLOR_STYLES[card.color]
                } ${
                  playable
                    ? 'cursor-pointer ring-2 ring-white/80 hover:-translate-y-1'
                    : 'cursor-not-allowed opacity-50'
                }`}
              >
                <span className="leading-tight">{formatUnoCardLabel(card)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
