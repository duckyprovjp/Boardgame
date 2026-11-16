import type { GameActionLogEntry, GameModule, GamePlayer, GameResult } from '../game';
import { formatPlayingCard, type PlayingCard, type PlayingSuit } from './highCard';

export type BlackjackPlayerStatus = 'playing' | 'stood' | 'busted' | 'blackjack' | 'five_card';

export interface BlackjackOptions {
  rng?: () => number;
}

export interface BlackjackState {
  players: GamePlayer[];
  deck: PlayingCard[];
  hands: Record<string, PlayingCard[]>;
  statuses: Record<string, BlackjackPlayerStatus>;
  turnIndex: number;
  phase: 'playing' | 'finished';
  winnerIds: string[];
  actionLog: GameActionLogEntry[];
}

export type BlackjackAction = { type: 'HIT' } | { type: 'STAND' };

export interface BlackjackPlayerView {
  gameId: 'blackjack';
  phase: 'playing' | 'finished';
  currentTurnPlayerId: string | null;
  myPlayerId: string;
  myHand: PlayingCard[];
  myScore: number;
  legalActions: BlackjackAction[];
  players: Array<{
    id: string;
    username: string;
    avatarId: string;
    cardCount: number;
    status: BlackjackPlayerStatus;
    revealedHand: PlayingCard[] | null;
    revealedScore: number | null;
  }>;
  actionLog: GameActionLogEntry[];
  isGameOver: boolean;
  result: GameResult | null;
}

const SUITS: readonly PlayingSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function createShuffledDeck(rng: () => number = Math.random): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

export function calculateBlackjackScore(hand: PlayingCard[]): number {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 14) {
      aces++;
      total += 11;
    } else if (card.rank >= 10) {
      total += 10;
    } else {
      total += card.rank;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function getHandStrength(hand: PlayingCard[], status: BlackjackPlayerStatus): number {
  const score = calculateBlackjackScore(hand);
  if (status === 'busted' || score > 21) return -1;
  if (status === 'blackjack') return 1000;
  if (status === 'five_card') return 500 + score;
  return score;
}

function findNextPlayingIndex(
  players: GamePlayer[],
  statuses: Record<string, BlackjackPlayerStatus>,
  from: number,
): number | null {
  for (let i = from; i < players.length; i++) {
    if (statuses[players[i]!.id] === 'playing') return i;
  }
  return null;
}

function finalizeMatch(state: BlackjackState): BlackjackState {
  const nextLog = [...state.actionLog];
  const scored = state.players.map((p) => {
    const hand = state.hands[p.id] ?? [];
    const status = state.statuses[p.id]!;
    return {
      player: p,
      score: calculateBlackjackScore(hand),
      strength: getHandStrength(hand, status),
    };
  });

  scored.sort((a, b) => b.strength - a.strength);
  const topStrength = scored[0]!.strength;
  const winnerIds = scored.filter((s) => s.strength === topStrength).map((s) => s.player.id);
  const winnerNames = scored
    .filter((s) => s.strength === topStrength)
    .map((s) => s.player.username)
    .join(', ');

  nextLog.push({
    id: `${Date.now()}-${nextLog.length}`,
    text: `🏆 Kết thúc! Người thắng: ${winnerNames}.`,
    timestamp: Date.now(),
  });

  return {
    ...state,
    phase: 'finished',
    winnerIds,
    actionLog: nextLog,
  };
}

export const BlackjackGame: GameModule<
  BlackjackState,
  BlackjackAction,
  BlackjackPlayerView,
  BlackjackOptions
> = {
  id: 'blackjack',
  minPlayers: 2,
  maxPlayers: 7,

  setup(players, options) {
    if (players.length < 2 || players.length > 7) {
      throw new Error('Blackjack (Xì Dách) cần từ 2 đến 7 người chơi');
    }

    const rng = options?.rng ?? Math.random;
    const deck = createShuffledDeck(rng);
    const hands: Record<string, PlayingCard[]> = {};
    const statuses: Record<string, BlackjackPlayerStatus> = {};

    for (const p of players) {
      const hand = [deck.pop()!, deck.pop()!];
      hands[p.id] = hand;
      const score = calculateBlackjackScore(hand);
      const isTwoAces = hand[0]!.rank === 14 && hand[1]!.rank === 14;
      statuses[p.id] = score === 21 || isTwoAces ? 'blackjack' : 'playing';
    }

    const firstTurn = findNextPlayingIndex(players, statuses, 0);
    const baseState: BlackjackState = {
      players: [...players],
      deck,
      hands,
      statuses,
      turnIndex: firstTurn ?? 0,
      phase: 'playing',
      winnerIds: [],
      actionLog: [
        {
          id: 'start',
          text: `Ván Blackjack (Xì Dách) bắt đầu với ${players.length} người chơi.`,
          timestamp: Date.now(),
        },
      ],
    };

    if (firstTurn === null) {
      return finalizeMatch(baseState);
    }

    return baseState;
  },

  getLegalActions(state, playerId) {
    if (state.phase !== 'playing') return [];
    const current = state.players[state.turnIndex];
    if (!current || current.id !== playerId) return [];
    if (state.statuses[playerId] !== 'playing') return [];
    return [{ type: 'HIT' }, { type: 'STAND' }];
  },

  applyAction(state, playerId, action) {
    const legal = this.getLegalActions(state, playerId);
    if (!legal.some((a) => a.type === action.type)) {
      throw new Error('Hành động không hợp lệ hoặc chưa tới lượt');
    }

    const actor = state.players.find((p) => p.id === playerId)!;
    const nextDeck = [...state.deck];
    const nextHands: Record<string, PlayingCard[]> = {};
    for (const [k, v] of Object.entries(state.hands)) {
      nextHands[k] = [...v];
    }
    const nextStatuses = { ...state.statuses };
    const nextLog = [...state.actionLog];

    if (action.type === 'STAND') {
      nextStatuses[playerId] = 'stood';
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} chọn Dừng bài.`,
        timestamp: Date.now(),
      });
    } else {
      const card = nextDeck.pop();
      if (card) {
        nextHands[playerId]!.push(card);
        const score = calculateBlackjackScore(nextHands[playerId]!);
        if (score > 21) {
          nextStatuses[playerId] = 'busted';
          nextLog.push({
            id: `${Date.now()}-${nextLog.length}`,
            text: `${actor.username} rút thêm bài (${formatPlayingCard(card)}) và bị Quắc!`,
            timestamp: Date.now(),
          });
        } else if (nextHands[playerId]!.length >= 5) {
          nextStatuses[playerId] = 'five_card';
          nextLog.push({
            id: `${Date.now()}-${nextLog.length}`,
            text: `${actor.username} đạt Ngũ Linh (5 lá ≤ 21)!`,
            timestamp: Date.now(),
          });
        } else if (score === 21) {
          nextStatuses[playerId] = 'stood';
          nextLog.push({
            id: `${Date.now()}-${nextLog.length}`,
            text: `${actor.username} rút đạt 21 điểm và tự động dừng.`,
            timestamp: Date.now(),
          });
        } else {
          nextLog.push({
            id: `${Date.now()}-${nextLog.length}`,
            text: `${actor.username} rút thêm 1 lá bài.`,
            timestamp: Date.now(),
          });
        }
      } else {
        nextStatuses[playerId] = 'stood';
      }
    }

    const nextIdx =
      nextStatuses[playerId] === 'playing'
        ? state.turnIndex
        : findNextPlayingIndex(state.players, nextStatuses, state.turnIndex + 1);

    const updated: BlackjackState = {
      ...state,
      deck: nextDeck,
      hands: nextHands,
      statuses: nextStatuses,
      turnIndex: nextIdx ?? state.turnIndex,
      actionLog: nextLog,
    };

    if (nextIdx === null) {
      return finalizeMatch(updated);
    }

    return updated;
  },

  getPlayerView(state, playerId) {
    const myHand = [...(state.hands[playerId] ?? [])];
    const currentTurnPlayerId =
      state.phase === 'playing' ? (state.players[state.turnIndex]?.id ?? null) : null;

    return {
      gameId: 'blackjack',
      phase: state.phase,
      currentTurnPlayerId,
      myPlayerId: playerId,
      myHand,
      myScore: calculateBlackjackScore(myHand),
      legalActions: this.getLegalActions(state, playerId),
      players: state.players.map((p) => {
        const hand = state.hands[p.id] ?? [];
        const revealed = state.phase === 'finished' || p.id === playerId;
        return {
          id: p.id,
          username: p.username,
          avatarId: p.avatarId,
          cardCount: hand.length,
          status: state.statuses[p.id]!,
          revealedHand: revealed ? [...hand] : null,
          revealedScore: revealed ? calculateBlackjackScore(hand) : null,
        };
      }),
      actionLog: state.actionLog,
      isGameOver: this.isGameOver(state),
      result: this.isGameOver(state) ? this.getResult(state) : null,
    };
  },

  isGameOver(state) {
    return state.phase === 'finished';
  },

  getResult(state) {
    const scored = state.players.map((p) => {
      const hand = state.hands[p.id] ?? [];
      const status = state.statuses[p.id]!;
      return {
        playerId: p.id,
        score: calculateBlackjackScore(hand),
        strength: getHandStrength(hand, status),
      };
    });
    scored.sort((a, b) => b.strength - a.strength);

    return {
      winnerIds: [...state.winnerIds],
      rankings: scored.map((s, idx) => ({
        playerId: s.playerId,
        rank: idx + 1,
        score: s.score,
      })),
      summary: 'Kết thúc ván Blackjack (Xì Dách)',
    };
  },
};
