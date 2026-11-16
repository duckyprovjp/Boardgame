import type { GameActionLogEntry, GameModule, GamePlayer, GameResult } from '../game';

export type PlayingSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface PlayingCard {
  rank: number; // 2..14 (14 = Ace)
  suit: PlayingSuit;
}

export interface HighCardOptions {
  rng?: () => number;
}

export interface HighCardState {
  players: GamePlayer[];
  deck: PlayingCard[];
  hands: Record<string, PlayingCard | null>;
  playedCards: Record<string, PlayingCard | null>;
  swappedUsed: Record<string, boolean>;
  turnIndex: number;
  phase: 'playing' | 'finished';
  actionLog: GameActionLogEntry[];
  winnerIds: string[];
}

export type HighCardAction = { type: 'PLAY_CARD' } | { type: 'SWAP_CARD' };

export interface HighCardPlayerView {
  gameId: 'high-card';
  phase: 'playing' | 'finished';
  currentTurnPlayerId: string | null;
  myPlayerId: string;
  myHand: PlayingCard | null;
  hasSwapped: boolean;
  legalActions: HighCardAction[];
  players: Array<{
    id: string;
    username: string;
    avatarId: string;
    cardCount: number;
    playedCard: PlayingCard | null;
  }>;
  actionLog: GameActionLogEntry[];
  isGameOver: boolean;
  result: GameResult | null;
}

const SUITS: readonly PlayingSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_STRENGTH: Record<PlayingSuit, number> = {
  clubs: 1,
  diamonds: 2,
  hearts: 3,
  spades: 4,
};

export function formatPlayingCard(card: PlayingCard): string {
  const rankLabel =
    card.rank === 14
      ? 'A'
      : card.rank === 13
        ? 'K'
        : card.rank === 12
          ? 'Q'
          : card.rank === 11
            ? 'J'
            : String(card.rank);
  const suitSymbol =
    card.suit === 'spades'
      ? '♠'
      : card.suit === 'hearts'
        ? '♥'
        : card.suit === 'diamonds'
          ? '♦'
          : '♣';
  return `${rankLabel}${suitSymbol}`;
}

function createShuffledDeck(rng: () => number): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = temp;
  }
  return deck;
}

function compareCards(a: PlayingCard, b: PlayingCard): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return SUIT_STRENGTH[a.suit] - SUIT_STRENGTH[b.suit];
}

export const HighCardGame: GameModule<
  HighCardState,
  HighCardAction,
  HighCardPlayerView,
  HighCardOptions
> = {
  id: 'high-card',
  minPlayers: 2,
  maxPlayers: 4,

  setup(players, options) {
    if (players.length < 2 || players.length > 4) {
      throw new Error('Bài Cao cần từ 2 đến 4 người chơi');
    }

    const rng = options?.rng ?? Math.random;
    const deck = createShuffledDeck(rng);
    const hands: Record<string, PlayingCard | null> = {};
    const playedCards: Record<string, PlayingCard | null> = {};
    const swappedUsed: Record<string, boolean> = {};

    for (const p of players) {
      hands[p.id] = deck.pop() ?? null;
      playedCards[p.id] = null;
      swappedUsed[p.id] = false;
    }

    return {
      players: [...players],
      deck,
      hands,
      playedCards,
      swappedUsed,
      turnIndex: 0,
      phase: 'playing',
      actionLog: [
        {
          id: 'start',
          text: `Trận Bài Cao bắt đầu với ${players.length} người chơi.`,
          timestamp: Date.now(),
        },
      ],
      winnerIds: [],
    };
  },

  getLegalActions(state, playerId) {
    if (state.phase !== 'playing') return [];
    const current = state.players[state.turnIndex];
    if (!current || current.id !== playerId) return [];

    const actions: HighCardAction[] = [{ type: 'PLAY_CARD' }];
    if (!state.swappedUsed[playerId] && state.deck.length > 0) {
      actions.push({ type: 'SWAP_CARD' });
    }
    return actions;
  },

  applyAction(state, playerId, action) {
    const legal = this.getLegalActions(state, playerId);
    const isLegal = legal.some((a) => a.type === action.type);
    if (!isLegal) {
      throw new Error('Hành động không hợp lệ hoặc chưa tới lượt');
    }

    const player = state.players.find((p) => p.id === playerId)!;
    const nextDeck = [...state.deck];
    const nextHands = { ...state.hands };
    const nextPlayed = { ...state.playedCards };
    const nextSwapped = { ...state.swappedUsed };
    const nextLog = [...state.actionLog];

    if (action.type === 'SWAP_CARD') {
      const drawn = nextDeck.pop()!;
      const oldCard = nextHands[playerId];
      if (oldCard) {
        nextDeck.unshift(oldCard);
      }
      nextHands[playerId] = drawn;
      nextSwapped[playerId] = true;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${player.username} đã đổi 1 lá bài mới.`,
        timestamp: Date.now(),
      });

      return {
        ...state,
        deck: nextDeck,
        hands: nextHands,
        swappedUsed: nextSwapped,
        actionLog: nextLog,
      };
    }

    // PLAY_CARD
    const card = nextHands[playerId]!;
    nextHands[playerId] = null;
    nextPlayed[playerId] = card;
    nextLog.push({
      id: `${Date.now()}-${nextLog.length}`,
      text: `${player.username} đã lật lá ${formatPlayingCard(card)}.`,
      timestamp: Date.now(),
    });

    const allPlayed = state.players.every((p) => nextPlayed[p.id] !== null);
    if (allPlayed) {
      const sorted = [...state.players].sort((a, b) =>
        compareCards(nextPlayed[b.id]!, nextPlayed[a.id]!),
      );
      const topPlayer = sorted[0]!;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${topPlayer.username} thắng với lá ${formatPlayingCard(nextPlayed[topPlayer.id]!)}!`,
        timestamp: Date.now(),
      });

      return {
        ...state,
        deck: nextDeck,
        hands: nextHands,
        playedCards: nextPlayed,
        phase: 'finished',
        winnerIds: [topPlayer.id],
        actionLog: nextLog,
      };
    }

    return {
      ...state,
      deck: nextDeck,
      hands: nextHands,
      playedCards: nextPlayed,
      turnIndex: (state.turnIndex + 1) % state.players.length,
      actionLog: nextLog,
    };
  },

  getPlayerView(state, playerId) {
    const currentTurnPlayerId =
      state.phase === 'playing' ? (state.players[state.turnIndex]?.id ?? null) : null;

    return {
      gameId: 'high-card',
      phase: state.phase,
      currentTurnPlayerId,
      myPlayerId: playerId,
      myHand: state.hands[playerId] ?? null,
      hasSwapped: Boolean(state.swappedUsed[playerId]),
      legalActions: this.getLegalActions(state, playerId),
      players: state.players.map((p) => ({
        id: p.id,
        username: p.username,
        avatarId: p.avatarId,
        cardCount: state.hands[p.id] ? 1 : 0,
        playedCard: state.playedCards[p.id] ?? null,
      })),
      actionLog: state.actionLog,
      isGameOver: this.isGameOver(state),
      result: this.isGameOver(state) ? this.getResult(state) : null,
    };
  },

  isGameOver(state) {
    return state.phase === 'finished';
  },

  getResult(state) {
    const sorted = [...state.players].sort((a, b) => {
      const ca = state.playedCards[a.id];
      const cb = state.playedCards[b.id];
      if (!ca || !cb) return 0;
      return compareCards(cb, ca);
    });

    return {
      winnerIds: [...state.winnerIds],
      rankings: sorted.map((p, idx) => ({
        playerId: p.id,
        rank: idx + 1,
        score: state.playedCards[p.id]?.rank ?? 0,
      })),
      summary: 'Kết thúc ván Bài Cao',
    };
  },
};
