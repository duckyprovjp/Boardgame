'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DiceFateAction,
  DiceFateCardInstance,
  DiceFatePlayerView,
} from '@boardgame/shared';

interface DiceFateBoardProps {
  view: DiceFatePlayerView;
  onAction: (action: DiceFateAction) => void;
}

export function DiceFateBoard({ view, onAction }: DiceFateBoardProps) {
  const [shaking, setShaking] = useState(false);
  const [pendingTargetCard, setPendingTargetCard] = useState<DiceFateCardInstance | null>(null);

  const canShake = view.legalActions.some((a) => a.type === 'SHAKE_DIE');
  const canEndTurn = view.legalActions.some((a) => a.type === 'END_TURN');
  const canPassCancel = view.legalActions.some((a) => a.type === 'PASS_CANCEL');
  const cancelAction = view.legalActions.find(
    (a): a is Extract<DiceFateAction, { type: 'PLAY_CANCEL' }> => a.type === 'PLAY_CANCEL',
  );
  const dieTargetActions = view.legalActions.filter(
    (a): a is Extract<DiceFateAction, { type: 'CHOOSE_DIE_TARGET' }> =>
      a.type === 'CHOOSE_DIE_TARGET',
  );

  const cardDefMap = new Map(view.rules.cards.map((c) => [c.id, c]));
  const otherAlive = view.players.filter((p) => p.id !== view.myPlayerId && p.alive);

  const triggerShake = useCallback(() => {
    if (!canShake || shaking) return;
    setShaking(true);
    setTimeout(() => {
      setShaking(false);
      onAction({ type: 'SHAKE_DIE' });
    }, 450);
  }, [canShake, shaking, onAction]);

  // Mobile devicemotion visual shake trigger (server still decides outcome)
  useEffect(() => {
    if (!canShake || typeof window === 'undefined') return;
    let lastTrigger = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.abs(acc.x ?? 0) + Math.abs(acc.y ?? 0) + Math.abs(acc.z ?? 0);
      if (magnitude > 28 && Date.now() - lastTrigger > 1200) {
        lastTrigger = Date.now();
        triggerShake();
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [canShake, triggerShake]);

  const handleCardClick = (card: DiceFateCardInstance) => {
    if (view.phase === 'cancel_window' && cancelAction && card.instanceId === cancelAction.instanceId) {
      onAction(cancelAction);
      return;
    }

    const def = cardDefMap.get(card.defId);
    if (!def) return;

    if (def.requiresTarget) {
      const legalForCard = view.legalActions.filter(
        (a): a is Extract<DiceFateAction, { type: 'PLAY_CARD' }> =>
          a.type === 'PLAY_CARD' && a.instanceId === card.instanceId,
      );
      if (legalForCard.length === 1) {
        onAction(legalForCard[0]!);
      } else if (legalForCard.length > 1) {
        setPendingTargetCard(card);
      }
      return;
    }

    const direct = view.legalActions.find(
      (a) => a.type === 'PLAY_CARD' && a.instanceId === card.instanceId,
    );
    if (direct) onAction(direct);
  };

  return (
    <div className="space-y-4">
      {/* Die & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-3xl transition-transform ${
              shaking ? 'animate-bounce' : ''
            }`}
          >
            {view.lastDieFace ? view.lastDieFace.emoji : '🎲'}
          </div>
          <div className="text-xs">
            <p className="text-sm font-bold text-white">
              {view.lastDieFace ? view.lastDieFace.label : 'Chưa lắc xúc xắc'}
            </p>
            <p className="text-slate-400">
              {view.lastDieFace
                ? view.lastDieFace.description
                : 'Nhấn nút Lắc Xúc Xắc (hoặc lắc điện thoại)'}
            </p>
            {view.bannedDeck && (
              <p className="mt-1 font-semibold text-rose-300">
                🚫 Đang cấm thẻ {view.bannedDeck === 'red' ? 'Đỏ' : 'Xanh'} vòng này
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canShake && (
            <button
              type="button"
              onClick={triggerShake}
              disabled={shaking}
              className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
            >
              {shaking ? 'Đang lắc...' : '🎲 Lắc Xúc Xắc'}
            </button>
          )}
          {canEndTurn && (
            <button
              type="button"
              onClick={() => onAction({ type: 'END_TURN' })}
              className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Kết thúc lượt
            </button>
          )}
        </div>
      </div>

      {/* Die target picker */}
      {dieTargetActions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
          <span className="text-xs font-semibold text-rose-200">
            🎯 Chọn 1 người chơi chịu phạt từ xúc xắc:
          </span>
          <div className="flex flex-wrap gap-2">
            {dieTargetActions.map((act) => {
              const target = view.players.find((p) => p.id === act.targetId);
              return (
                <button
                  key={act.targetId}
                  type="button"
                  onClick={() => onAction(act)}
                  className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white"
                >
                  {target?.username ?? act.targetId}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel Red Card window */}
      {view.phase === 'cancel_window' && view.pendingRedCard && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
          <p className="text-xs text-emerald-200">
            Thẻ Đỏ vừa được đánh! Bạn có muốn dùng thẻ Xanh &quot;Hoá Giải&quot; không?
          </p>
          <div className="flex gap-2">
            {cancelAction && (
              <button
                type="button"
                onClick={() => onAction(cancelAction)}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
              >
                ✨ Dùng Hoá Giải
              </button>
            )}
            {canPassCancel && (
              <button
                type="button"
                onClick={() => onAction({ type: 'PASS_CANCEL' })}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200"
              >
                Không huỷ
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dare banner */}
      {view.activeDare && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          🎭 <strong>{view.activeDare.targetUsername}</strong>: {view.activeDare.prompt}
        </div>
      )}

      {/* Private Peek */}
      {view.peekedHand && (
        <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-3 text-xs text-purple-200">
          👁️ Bài của <strong>{view.peekedHand.targetUsername}</strong>:{' '}
          {view.peekedHand.cards.map((c) => cardDefMap.get(c.defId)?.name ?? c.defId).join(', ')}
        </div>
      )}

      {/* Card target picker */}
      {pendingTargetCard && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-slate-900 p-3">
          <span className="text-xs text-amber-200">
            Chọn mục tiêu cho {cardDefMap.get(pendingTargetCard.defId)?.name}:
          </span>
          <div className="flex flex-wrap gap-2">
            {otherAlive.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onAction({
                    type: 'PLAY_CARD',
                    instanceId: pendingTargetCard.instanceId,
                    targetId: p.id,
                  });
                  setPendingTargetCard(null);
                }}
                className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950"
              >
                {p.username} (❤️{p.lives})
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
        <p className="mb-2 text-xs text-slate-400">
          Bài định mệnh của bạn ({view.myHand.length} lá)
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {view.myHand.map((card) => {
            const def = cardDefMap.get(card.defId);
            if (!def) return null;
            const playable = view.legalActions.some(
              (a) =>
                (a.type === 'PLAY_CARD' || a.type === 'PLAY_CANCEL') &&
                a.instanceId === card.instanceId,
            );
            return (
              <button
                key={card.instanceId}
                type="button"
                disabled={!playable}
                onClick={() => handleCardClick(card)}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  def.deck === 'green'
                    ? 'border-emerald-500/40 bg-emerald-950/40'
                    : 'border-rose-500/40 bg-rose-950/40'
                } ${playable ? 'hover:border-white' : 'cursor-not-allowed opacity-55'}`}
              >
                <span className="text-xl">{def.emoji}</span>
                <span className="mt-1 text-xs font-bold text-white">{def.name}</span>
                <span className="mt-0.5 text-[10px] leading-tight text-slate-300">
                  {def.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
