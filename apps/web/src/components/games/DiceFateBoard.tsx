'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { DiceFateAction, DiceFatePlayerView } from '@boardgame/shared';

interface DiceFateBoardProps {
  view: DiceFatePlayerView;
  onAction: (action: DiceFateAction) => void;
}

export function DiceFateBoard({ view, onAction }: DiceFateBoardProps) {
  const [shaking, setShaking] = useState(false);
  const [pickingTarget, setPickingTarget] = useState(false);

  const canRoll = view.legalActions.some((a) => a.type === 'ROLL_DIE');
  const canPassWindow = view.legalActions.some((a) => a.type === 'PASS_WINDOW');
  const dirActions = view.legalActions.filter(
    (a): a is Extract<DiceFateAction, { type: 'CHOOSE_DIRECTION' }> =>
      a.type === 'CHOOSE_DIRECTION',
  );
  const nextHolderActions = view.legalActions.filter(
    (a): a is Extract<DiceFateAction, { type: 'CHOOSE_NEXT_HOLDER' }> =>
      a.type === 'CHOOSE_NEXT_HOLDER',
  );
  const playCardActions = view.legalActions.filter(
    (a): a is Extract<DiceFateAction, { type: 'PLAY_CARD' }> => a.type === 'PLAY_CARD',
  );

  const cardDef = view.myCard
    ? view.rules.cards.find((c) => c.id === view.myCard!.defId)
    : undefined;

  const triggerRoll = useCallback(() => {
    if (!canRoll || shaking) return;
    setShaking(true);
    setTimeout(() => {
      setShaking(false);
      onAction({ type: 'ROLL_DIE' });
    }, 450);
  }, [canRoll, shaking, onAction]);

  // Mobile devicemotion visual shake trigger (server decides outcome)
  useEffect(() => {
    if (!canRoll || typeof window === 'undefined') return;
    let lastTrigger = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.abs(acc.x ?? 0) + Math.abs(acc.y ?? 0) + Math.abs(acc.z ?? 0);
      if (mag > 28 && Date.now() - lastTrigger > 1200) {
        lastTrigger = Date.now();
        triggerRoll();
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [canRoll, triggerRoll]);

  const isReactionWindow =
    view.phase === 'START_OF_TURN_WINDOW' ||
    view.phase === 'BEFORE_ROLL_WINDOW' ||
    view.phase === 'AFTER_ROLL_WINDOW' ||
    view.phase === 'ON_ELIMINATED_WINDOW' ||
    view.phase === 'ON_RECEIVE_DIE_WINDOW';

  const handlePlayMyCard = () => {
    if (playCardActions.length === 0) return;
    if (playCardActions.length === 1 && !playCardActions[0]!.targetId) {
      onAction(playCardActions[0]!);
    } else {
      setPickingTarget(true);
    }
  };

  const canPlayMyCard = playCardActions.length > 0;
  const recentDiscard = view.recentDiscard ?? [];

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between pt-16 pb-4 sm:pt-20 sm:pb-6">
      {/* Draw Pile in top-left corner so it never overlaps players */}
      <div className="absolute left-4 top-4 z-20 flex flex-col items-center gap-1 sm:left-7 sm:top-5">
        <div className="relative h-24 w-16">
          {view.deckCount > 2 && (
            <div className="pointer-events-none absolute inset-0 -translate-x-1 translate-y-1 rounded-xl border border-white/20 bg-slate-950/90 shadow" />
          )}
          {view.deckCount > 1 && (
            <div className="pointer-events-none absolute inset-0 -translate-x-0.5 translate-y-0.5 rounded-xl border border-white/30 bg-slate-900/90 shadow" />
          )}
          <div className="relative flex h-full w-full flex-col items-center justify-center rounded-xl border-2 border-white/40 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-xs font-bold text-white shadow-xl">
            <span className="text-[10px] uppercase tracking-wider text-slate-300">Nọc</span>
            <span className="mt-1 text-base font-black text-amber-300">{view.deckCount}</span>
          </div>
        </div>
        <span className="text-[10px] font-medium text-white/75">Bài rút</span>
      </div>

      {/* Center of the table: Die + Discard Pile */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex items-center justify-center gap-5 sm:gap-7">
          {/* Center 3D-looking Die */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-stone-800 to-stone-950 text-3xl font-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.6)] transition-transform ${
                shaking ? 'animate-bounce' : ''
              }`}
            >
              {view.lastDieValue ?? '?'}
            </div>
            <p className="text-[11px] text-amber-200">
              Mặt nổ: [{view.effectiveLethalFaces.join(', ')}]
            </p>
          </div>

          {/* Discard Pile (Chồng bài đã đánh ở giữa bàn cho mọi người) */}
          <div className="flex flex-col items-center gap-1">
            <div className="relative h-24 w-16">
              {recentDiscard.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-white/25 bg-slate-950/40 text-center text-[10px] text-white/50">
                  Chưa đánh
                </div>
              ) : (
                recentDiscard.map((inst, idx, arr) => {
                  const def = view.rules.cards.find((c) => c.id === inst.defId);
                  const isTop = idx === arr.length - 1;
                  const rotDeg = isTop ? 4 : idx % 2 === 0 ? -7 : 7;
                  return (
                    <div
                      key={inst.instanceId}
                      title={def ? `${def.name}: ${def.description}` : inst.defId}
                      style={{ '--card-rot': `${rotDeg}deg` } as CSSProperties}
                      className={`absolute inset-0 flex flex-col items-center justify-between rounded-xl border-2 p-1.5 text-center shadow-2xl transition-transform ${
                        def?.color === 'green'
                          ? 'border-emerald-300 bg-emerald-900 text-white'
                          : 'border-rose-300 bg-rose-900 text-white'
                      } ${isTop ? 'animate-card-play hover:z-30 hover:scale-110' : 'opacity-80'}`}
                    >
                      <span className="rounded bg-black/35 px-1 py-0.5 text-[8px] font-bold uppercase text-amber-300">
                        {def?.color === 'green' ? 'Xanh' : 'Đỏ'}
                      </span>
                      <span className="line-clamp-3 text-[10px] font-black leading-tight">
                        {def?.name ?? inst.defId}
                      </span>
                      <span className="text-[8px] text-white/75">{def?.timing ?? ''}</span>
                    </div>
                  );
                })
              )}
            </div>
            <span className="text-[10px] font-medium text-white/75">Đã đánh</span>
          </div>
        </div>

        {view.phase === 'ON_ELIMINATED_WINDOW' && (
          <div className="animate-pulse rounded-xl bg-rose-600/90 px-4 py-1.5 text-sm font-black text-white shadow-lg">
            BÙM! Đang xét thẻ cứu mạng...
          </div>
        )}

        {canRoll && (
          <button
            type="button"
            onClick={triggerRoll}
            disabled={shaking}
            className="cursor-pointer rounded-xl bg-amber-400 px-5 py-2 text-xs font-black text-slate-950 shadow-lg hover:bg-amber-300"
          >
            {shaking ? 'Đang lắc...' : 'Tung Xúc Xắc'}
          </button>
        )}

        {/* Direction chooser */}
        {dirActions.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-400/40 bg-slate-950/90 px-4 py-2">
            <span className="text-xs font-semibold text-emerald-300">Chọn hướng chuyền:</span>
            <button
              type="button"
              onClick={() => onAction({ type: 'CHOOSE_DIRECTION', direction: 'left' })}
              className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
            >
              ← Trái
            </button>
            <button
              type="button"
              onClick={() => onAction({ type: 'CHOOSE_DIRECTION', direction: 'right' })}
              className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
            >
              Phải →
            </button>
          </div>
        )}

        {/* Eliminated player chooses next holder */}
        {nextHolderActions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-400/40 bg-slate-950/90 px-4 py-2">
            <span className="text-xs font-semibold text-rose-300">
              Trao xúc xắc cho người kế bên:
            </span>
            {nextHolderActions.map((act) => {
              const t = view.players.find((p) => p.id === act.targetId);
              return (
                <button
                  key={act.targetId}
                  type="button"
                  onClick={() => onAction(act)}
                  className="cursor-pointer rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950"
                >
                  {t?.username}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Target selector when playing targeted card */}
      {pickingTarget && (
        <div className="z-30 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400 bg-slate-950/95 px-4 py-2.5 shadow-xl">
          <span className="text-xs font-semibold text-amber-300">Chọn mục tiêu:</span>
          {playCardActions.map((act) => {
            const t = view.players.find((p) => p.id === act.targetId);
            return (
              <button
                key={act.targetId}
                type="button"
                onClick={() => {
                  onAction(act);
                  setPickingTarget(false);
                }}
                className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
              >
                {t?.username}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPickingTarget(false)}
            className="cursor-pointer rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300"
          >
            Huỷ
          </button>
        </div>
      )}

      {/* Reaction window (indistinguishable for all alive players) + Hero card with hover-lift */}
      <div className="flex w-full flex-col items-center gap-2 px-4 pb-2 pt-4">
        {isReactionWindow && canPassWindow && (
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-slate-950/90 px-4 py-2 text-xs">
            <span className="text-slate-200">Cửa sổ thẻ ({view.phase})</span>
            <button
              type="button"
              onClick={() => onAction({ type: 'PASS_WINDOW' })}
              className="cursor-pointer rounded-lg bg-slate-700 px-3 py-1 font-bold text-white hover:bg-slate-600"
            >
              Bỏ qua
            </button>
          </div>
        )}

        {cardDef ? (
          <button
            type="button"
            aria-disabled={!canPlayMyCard}
            title={`${cardDef.name}: ${cardDef.description}`}
            onClick={handlePlayMyCard}
            className={`relative max-w-xs rounded-xl border-2 px-4 py-3 text-left shadow-xl transition-all duration-150 ease-out hover:z-30 hover:scale-105 hover:shadow-2xl ${
              cardDef.color === 'green'
                ? 'border-emerald-400 bg-emerald-950/90'
                : 'border-rose-400 bg-rose-950/90'
            } ${
              canPlayMyCard
                ? '-translate-y-1.5 cursor-pointer ring-2 ring-amber-400 hover:-translate-y-5'
                : 'cursor-default opacity-85 hover:-translate-y-4 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black text-white">{cardDef.name}</span>
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                {cardDef.timing}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-200">{cardDef.description}</p>
          </button>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-xs text-slate-400">
            Bạn đã sử dụng thẻ bài của mình
          </div>
        )}
      </div>
    </div>
  );
}
