'use client';

import type { PlayingCard } from '@boardgame/shared';

interface PlayingCardTileProps {
  card?: PlayingCard;
  faceDown?: boolean;
  size?: 'sm' | 'md';
  highlighted?: boolean;
}

const SUIT_SYMBOLS: Record<PlayingCard['suit'], string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

function formatRank(rank: number): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

/**
 * Shared playing card tile for 52-card games (Poker, Blackjack, High Card).
 * Lifts upward on hover so overlapped cards are easy to identify.
 */
export function PlayingCardTile({
  card,
  faceDown = false,
  size = 'md',
  highlighted = false,
}: PlayingCardTileProps) {
  const sizeClass =
    size === 'sm'
      ? 'h-16 w-11 rounded-lg text-xs'
      : 'h-20 w-14 sm:h-24 sm:w-16 rounded-xl text-sm';

  if (faceDown || !card) {
    return (
      <div
        className={`relative flex select-none items-center justify-center border-2 border-white/40 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 font-bold text-white/60 shadow-lg transition-all duration-150 ease-out hover:z-30 hover:-translate-y-4 hover:scale-105 hover:shadow-2xl ${sizeClass}`}
      >
        <div className="h-[78%] w-[78%] rounded border border-white/20 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent)]" />
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const colorClass = isRed ? 'text-rose-600' : 'text-slate-900';
  const rank = formatRank(card.rank);
  const suit = SUIT_SYMBOLS[card.suit];

  return (
    <div
      className={`relative flex select-none flex-col justify-between border-2 bg-white p-1.5 font-black shadow-lg transition-all duration-150 ease-out hover:z-30 hover:-translate-y-4 hover:scale-105 hover:shadow-2xl ${sizeClass} ${colorClass} ${
        highlighted ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-col items-start leading-none">
        <span>{rank}</span>
        <span className="text-[10px]">{suit}</span>
      </div>
      <div className="self-center text-xl leading-none sm:text-2xl">{suit}</div>
      <div className="flex rotate-180 flex-col items-start leading-none">
        <span>{rank}</span>
        <span className="text-[10px]">{suit}</span>
      </div>
    </div>
  );
}
