import type { GameActionLogEntry, GameModule, GamePlayer, GameResult } from '../game';
import { formatPlayingCard, type PlayingCard, type PlayingSuit } from './highCard';

export type PokerStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'finished';

export interface PokerOptions {
  rng?: () => number;
  startingChips?: number;
  smallBlind?: number;
  bigBlind?: number;
}

export interface PokerState {
  players: GamePlayer[];
  chips: Record<string, number>;
  bets: Record<string, number>;
  totalContributed: Record<string, number>;
  folded: Record<string, boolean>;
  allIn: Record<string, boolean>;
  actedThisStreet: Record<string, boolean>;
  holeCards: Record<string, PlayingCard[]>;
  communityCards: PlayingCard[];
  deck: PlayingCard[];
  pot: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  dealerIndex: number;
  turnIndex: number;
  street: PokerStreet;
  handNumber: number;
  eliminationOrder: string[];
  winnerIds: string[];
  lastShowdownText: string | null;
  actionLog: GameActionLogEntry[];
}

export type PokerAction =
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL' }
  | { type: 'RAISE'; amount: number }
  | { type: 'ALL_IN' };

export interface PokerPlayerView {
  gameId: 'poker';
  street: PokerStreet;
  handNumber: number;
  pot: number;
  currentBet: number;
  bigBlind: number;
  dealerId: string;
  currentTurnPlayerId: string | null;
  myPlayerId: string;
  myHoleCards: PlayingCard[];
  communityCards: PlayingCard[];
  lastShowdownText: string | null;
  legalActions: PokerAction[];
  players: Array<{
    id: string;
    username: string;
    avatarId: string;
    chips: number;
    bet: number;
    folded: boolean;
    allIn: boolean;
    active: boolean;
    revealedCards: PlayingCard[] | null;
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

export interface EvaluatedHand {
  category: number; // 0=High Card .. 8=Straight Flush
  tiebreakers: number[];
  label: string;
}

const HAND_LABELS = [
  'Mậu Thầu',
  'Một Đôi',
  'Hai Đôi',
  'Sám Cô',
  'Sảnh',
  'Thùng',
  'Cù Lũ',
  'Tứ Quý',
  'Thùng Phá Sảnh',
] as const;

function evaluate5(cards: PlayingCard[]): EvaluatedHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0]!.suit);

  const counts = new Map<number, number>();
  for (const r of ranks) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0]! - uniqueRanks[4]! === 4) {
      straightHigh = uniqueRanks[0]!;
    } else if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      straightHigh = 5; // Wheel A-2-3-4-5
    }
  }

  let category = 0;
  let tiebreakers = ranks;

  if (isFlush && straightHigh > 0) {
    category = 8;
    tiebreakers = [straightHigh];
  } else if (groups[0]![1] === 4) {
    category = 7;
    tiebreakers = [groups[0]![0], groups[1]![0]];
  } else if (groups[0]![1] === 3 && groups[1]?.[1] === 2) {
    category = 6;
    tiebreakers = [groups[0]![0], groups[1]![0]];
  } else if (isFlush) {
    category = 5;
    tiebreakers = ranks;
  } else if (straightHigh > 0) {
    category = 4;
    tiebreakers = [straightHigh];
  } else if (groups[0]![1] === 3) {
    category = 3;
    tiebreakers = groups.map((g) => g[0]);
  } else if (groups[0]![1] === 2 && groups[1]?.[1] === 2) {
    category = 2;
    tiebreakers = groups.map((g) => g[0]);
  } else if (groups[0]![1] === 2) {
    category = 1;
    tiebreakers = groups.map((g) => g[0]);
  }

  return {
    category,
    tiebreakers,
    label: HAND_LABELS[category]!,
  };
}

export function compareEvaluatedHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const va = a.tiebreakers[i] ?? 0;
    const vb = b.tiebreakers[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function evaluateBestHand(cards: PlayingCard[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error('Cần ít nhất 5 lá bài để đánh giá');
  }
  if (cards.length === 5) return evaluate5(cards);

  let best: EvaluatedHand | null = null;
  const n = cards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const hand = evaluate5([cards[i]!, cards[j]!, cards[k]!, cards[l]!, cards[m]!]);
            if (!best || compareEvaluatedHands(hand, best) > 0) {
              best = hand;
            }
          }
        }
      }
    }
  }
  return best!;
}

function nextIndexWhere(
  players: GamePlayer[],
  from: number,
  predicate: (id: string) => boolean,
): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (from + offset) % n;
    if (predicate(players[idx]!.id)) return idx;
  }
  return from;
}

function startNewHand(
  players: GamePlayer[],
  chips: Record<string, number>,
  dealerIndex: number,
  smallBlind: number,
  bigBlind: number,
  handNumber: number,
  eliminationOrder: string[],
  actionLog: GameActionLogEntry[],
  rng: () => number = Math.random,
): PokerState {
  const deck = createShuffledDeck(rng);
  const bets: Record<string, number> = {};
  const totalContributed: Record<string, number> = {};
  const folded: Record<string, boolean> = {};
  const allIn: Record<string, boolean> = {};
  const actedThisStreet: Record<string, boolean> = {};
  const holeCards: Record<string, PlayingCard[]> = {};

  const aliveIds = players.filter((p) => (chips[p.id] ?? 0) > 0).map((p) => p.id);
  for (const p of players) {
    const alive = (chips[p.id] ?? 0) > 0;
    bets[p.id] = 0;
    totalContributed[p.id] = 0;
    folded[p.id] = !alive;
    allIn[p.id] = false;
    actedThisStreet[p.id] = false;
    holeCards[p.id] = alive ? [deck.pop()!, deck.pop()!] : [];
  }

  const nextChips = { ...chips };
  const sbIndex =
    aliveIds.length === 2
      ? dealerIndex
      : nextIndexWhere(players, dealerIndex, (id) => (nextChips[id] ?? 0) > 0);
  const bbIndex = nextIndexWhere(players, sbIndex, (id) => (nextChips[id] ?? 0) > 0);

  const postBlind = (idx: number, amount: number): number => {
    const pid = players[idx]!.id;
    const actual = Math.min(nextChips[pid] ?? 0, amount);
    nextChips[pid] = (nextChips[pid] ?? 0) - actual;
    bets[pid] = actual;
    totalContributed[pid] = actual;
    if (nextChips[pid] === 0) allIn[pid] = true;
    return actual;
  };

  const sbPaid = postBlind(sbIndex, smallBlind);
  const bbPaid = postBlind(bbIndex, bigBlind);
  const pot = sbPaid + bbPaid;
  const currentBet = Math.max(sbPaid, bbPaid);

  const firstToAct = nextIndexWhere(
    players,
    bbIndex,
    (id) => !folded[id] && !allIn[id],
  );

  const nextLog = [
    ...actionLog,
    {
      id: `${Date.now()}-h${handNumber}`,
      text: `Ván #${handNumber} bắt đầu (Blind ${smallBlind}/${bigBlind}).`,
      timestamp: Date.now(),
    },
  ];

  return {
    players: [...players],
    chips: nextChips,
    bets,
    totalContributed,
    folded,
    allIn,
    actedThisStreet,
    holeCards,
    communityCards: [],
    deck,
    pot,
    currentBet,
    smallBlind,
    bigBlind,
    dealerIndex,
    turnIndex: firstToAct,
    street: 'preflop',
    handNumber,
    eliminationOrder: [...eliminationOrder],
    winnerIds: [],
    lastShowdownText: null,
    actionLog: nextLog,
  };
}

function finishHandAndMaybeMatch(state: PokerState): PokerState {
  const contenders = state.players.filter((p) => !state.folded[p.id]);
  const nextChips = { ...state.chips };
  const nextLog = [...state.actionLog];
  let showdownText = '';

  if (contenders.length === 1) {
    const solo = contenders[0]!;
    nextChips[solo.id] = (nextChips[solo.id] ?? 0) + state.pot;
    showdownText = `${solo.username} thắng ${state.pot} chip (đối thủ úp bài).`;
    nextLog.push({
      id: `${Date.now()}-${nextLog.length}`,
      text: `🏆 ${showdownText}`,
      timestamp: Date.now(),
    });
  } else {
    // Deal remaining community cards if all-in runout
    const board = [...state.communityCards];
    const deck = [...state.deck];
    while (board.length < 5 && deck.length > 0) {
      board.push(deck.pop()!);
    }

    const evals = contenders.map((p) => ({
      player: p,
      hand: evaluateBestHand([...(state.holeCards[p.id] ?? []), ...board]),
    }));

    evals.sort((a, b) => compareEvaluatedHands(b.hand, a.hand));
    const bestHand = evals[0]!.hand;
    const winners = evals.filter((e) => compareEvaluatedHands(e.hand, bestHand) === 0);

    const share = Math.floor(state.pot / winners.length);
    let remainder = state.pot - share * winners.length;
    for (const w of winners) {
      nextChips[w.player.id] = (nextChips[w.player.id] ?? 0) + share + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }

    const winnerNames = winners.map((w) => w.player.username).join(', ');
    showdownText = `${winnerNames} thắng ${state.pot} chip với ${bestHand.label}! (${board.map(formatPlayingCard).join(' ')})`;
    nextLog.push({
      id: `${Date.now()}-${nextLog.length}`,
      text: `🃏 Ngửa bài: ${showdownText}`,
      timestamp: Date.now(),
    });
  }

  // Record eliminations
  const nextElims = [...state.eliminationOrder];
  for (const p of state.players) {
    if ((nextChips[p.id] ?? 0) <= 0 && !nextElims.includes(p.id)) {
      nextElims.push(p.id);
    }
  }

  const survivors = state.players.filter((p) => (nextChips[p.id] ?? 0) > 0);
  if (survivors.length <= 1) {
    const winnerIds = survivors.map((s) => s.id);
    if (survivors[0]) {
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `👑 ${survivors[0].username} thắng chung cuộc bàn Poker!`,
        timestamp: Date.now(),
      });
    }
    return {
      ...state,
      chips: nextChips,
      street: 'finished',
      eliminationOrder: nextElims,
      winnerIds,
      lastShowdownText: showdownText,
      actionLog: nextLog,
    };
  }

  const nextDealer = nextIndexWhere(state.players, state.dealerIndex, (id) => (nextChips[id] ?? 0) > 0);
  const nextState = startNewHand(
    state.players,
    nextChips,
    nextDealer,
    state.smallBlind,
    state.bigBlind,
    state.handNumber + 1,
    nextElims,
    nextLog,
  );
  return {
    ...nextState,
    lastShowdownText: showdownText,
  };
}

function advanceStreetOrShowdown(state: PokerState): PokerState {
  const nextDeck = [...state.deck];
  const nextBoard = [...state.communityCards];
  const nextBets: Record<string, number> = {};
  const nextActed: Record<string, boolean> = {};
  for (const p of state.players) {
    nextBets[p.id] = 0;
    nextActed[p.id] = false;
  }

  let nextStreet: PokerStreet = state.street;
  if (state.street === 'preflop') {
    nextStreet = 'flop';
    nextBoard.push(nextDeck.pop()!, nextDeck.pop()!, nextDeck.pop()!);
  } else if (state.street === 'flop') {
    nextStreet = 'turn';
    nextBoard.push(nextDeck.pop()!);
  } else if (state.street === 'turn') {
    nextStreet = 'river';
    nextBoard.push(nextDeck.pop()!);
  } else {
    return finishHandAndMaybeMatch(state);
  }

  const activeNotAllIn = state.players.filter((p) => !state.folded[p.id] && !state.allIn[p.id]);
  if (activeNotAllIn.length <= 1) {
    return finishHandAndMaybeMatch({
      ...state,
      deck: nextDeck,
      communityCards: nextBoard,
      bets: nextBets,
      currentBet: 0,
      street: nextStreet,
    });
  }

  const firstToAct = nextIndexWhere(
    state.players,
    state.dealerIndex,
    (id) => !state.folded[id] && !state.allIn[id],
  );

  const nextLog = [
    ...state.actionLog,
    {
      id: `${Date.now()}-${state.actionLog.length}`,
      text: `Vòng ${nextStreet.toUpperCase()}: ${nextBoard.map(formatPlayingCard).join(' ')}`,
      timestamp: Date.now(),
    },
  ];

  return {
    ...state,
    deck: nextDeck,
    communityCards: nextBoard,
    bets: nextBets,
    actedThisStreet: nextActed,
    currentBet: 0,
    street: nextStreet,
    turnIndex: firstToAct,
    actionLog: nextLog,
  };
}

export const PokerGame: GameModule<PokerState, PokerAction, PokerPlayerView, PokerOptions> = {
  id: 'poker',
  minPlayers: 2,
  maxPlayers: 8,

  setup(players, options) {
    if (players.length < 2 || players.length > 8) {
      throw new Error('Poker cần từ 2 đến 8 người chơi');
    }

    const startingChips = options?.startingChips ?? 500;
    const smallBlind = options?.smallBlind ?? 25;
    const bigBlind = options?.bigBlind ?? 50;
    const rng = options?.rng ?? Math.random;

    const chips: Record<string, number> = {};
    for (const p of players) {
      chips[p.id] = startingChips;
    }

    return startNewHand(players, chips, 0, smallBlind, bigBlind, 1, [], [], rng);
  },

  getLegalActions(state, playerId) {
    if (state.street === 'finished') return [];
    const current = state.players[state.turnIndex];
    if (!current || current.id !== playerId) return [];
    if (state.folded[playerId] || state.allIn[playerId]) return [];

    const myChips = state.chips[playerId] ?? 0;
    const myBet = state.bets[playerId] ?? 0;
    const toCall = Math.max(0, state.currentBet - myBet);

    const actions: PokerAction[] = [];
    if (toCall === 0) {
      actions.push({ type: 'CHECK' });
    } else {
      actions.push({ type: 'CALL' });
    }

    const minRaiseTotal = state.currentBet + state.bigBlind;
    const raiseCost = minRaiseTotal - myBet;
    if (myChips > raiseCost) {
      actions.push({ type: 'RAISE', amount: minRaiseTotal });
    }

    if (myChips > 0) {
      actions.push({ type: 'ALL_IN' });
    }

    actions.push({ type: 'FOLD' });
    return actions;
  },

  applyAction(state, playerId, action) {
    const legal = this.getLegalActions(state, playerId);
    const isLegal = legal.some((a) => JSON.stringify(a) === JSON.stringify(action));
    if (!isLegal) {
      throw new Error('Hành động Poker không hợp lệ');
    }

    const actor = state.players.find((p) => p.id === playerId)!;
    const nextChips = { ...state.chips };
    const nextBets = { ...state.bets };
    const nextContrib = { ...state.totalContributed };
    const nextFolded = { ...state.folded };
    const nextAllIn = { ...state.allIn };
    const nextActed = { ...state.actedThisStreet, [playerId]: true };
    let nextPot = state.pot;
    let nextCurrentBet = state.currentBet;
    const nextLog = [...state.actionLog];

    if (action.type === 'FOLD') {
      nextFolded[playerId] = true;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} úp bài.`,
        timestamp: Date.now(),
      });
    } else if (action.type === 'CHECK') {
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} xem bài (Check).`,
        timestamp: Date.now(),
      });
    } else if (action.type === 'CALL') {
      const toCall = Math.min(nextChips[playerId] ?? 0, nextCurrentBet - (nextBets[playerId] ?? 0));
      nextChips[playerId] = (nextChips[playerId] ?? 0) - toCall;
      nextBets[playerId] = (nextBets[playerId] ?? 0) + toCall;
      nextContrib[playerId] = (nextContrib[playerId] ?? 0) + toCall;
      nextPot += toCall;
      if (nextChips[playerId] === 0) nextAllIn[playerId] = true;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} theo ${toCall} chip.`,
        timestamp: Date.now(),
      });
    } else if (action.type === 'RAISE') {
      const needed = Math.min(nextChips[playerId] ?? 0, action.amount - (nextBets[playerId] ?? 0));
      nextChips[playerId] = (nextChips[playerId] ?? 0) - needed;
      nextBets[playerId] = (nextBets[playerId] ?? 0) + needed;
      nextContrib[playerId] = (nextContrib[playerId] ?? 0) + needed;
      nextPot += needed;
      if (nextBets[playerId]! > nextCurrentBet) {
        nextCurrentBet = nextBets[playerId]!;
        // Everyone else needs a chance to respond to the raise
        for (const p of state.players) {
          if (p.id !== playerId) nextActed[p.id] = false;
        }
      }
      if (nextChips[playerId] === 0) nextAllIn[playerId] = true;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} tố lên ${nextBets[playerId]} chip.`,
        timestamp: Date.now(),
      });
    } else if (action.type === 'ALL_IN') {
      const push = nextChips[playerId] ?? 0;
      nextChips[playerId] = 0;
      nextBets[playerId] = (nextBets[playerId] ?? 0) + push;
      nextContrib[playerId] = (nextContrib[playerId] ?? 0) + push;
      nextPot += push;
      nextAllIn[playerId] = true;
      if (nextBets[playerId]! > nextCurrentBet) {
        nextCurrentBet = nextBets[playerId]!;
        for (const p of state.players) {
          if (p.id !== playerId) nextActed[p.id] = false;
        }
      }
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `🔥 ${actor.username} TẤT TAY ${push} chip!`,
        timestamp: Date.now(),
      });
    }

    const updated: PokerState = {
      ...state,
      chips: nextChips,
      bets: nextBets,
      totalContributed: nextContrib,
      folded: nextFolded,
      allIn: nextAllIn,
      actedThisStreet: nextActed,
      pot: nextPot,
      currentBet: nextCurrentBet,
      actionLog: nextLog,
    };

    const nonFolded = updated.players.filter((p) => !updated.folded[p.id]);
    if (nonFolded.length <= 1) {
      return finishHandAndMaybeMatch(updated);
    }

    const activeCanAct = nonFolded.filter((p) => !updated.allIn[p.id]);
    const streetDone = activeCanAct.every(
      (p) => updated.actedThisStreet[p.id] && (updated.bets[p.id] ?? 0) === updated.currentBet,
    );

    if (streetDone) {
      return advanceStreetOrShowdown(updated);
    }

    const nextTurn = nextIndexWhere(
      updated.players,
      updated.turnIndex,
      (id) => !updated.folded[id] && !updated.allIn[id],
    );

    return {
      ...updated,
      turnIndex: nextTurn,
    };
  },

  getPlayerView(state, playerId) {
    const currentTurnPlayerId =
      state.street !== 'finished' ? (state.players[state.turnIndex]?.id ?? null) : null;

    return {
      gameId: 'poker',
      street: state.street,
      handNumber: state.handNumber,
      pot: state.pot,
      currentBet: state.currentBet,
      bigBlind: state.bigBlind,
      dealerId: state.players[state.dealerIndex]?.id ?? '',
      currentTurnPlayerId,
      myPlayerId: playerId,
      myHoleCards: [...(state.holeCards[playerId] ?? [])],
      communityCards: [...state.communityCards],
      lastShowdownText: state.lastShowdownText,
      legalActions: this.getLegalActions(state, playerId),
      players: state.players.map((p) => ({
        id: p.id,
        username: p.username,
        avatarId: p.avatarId,
        chips: state.chips[p.id] ?? 0,
        bet: state.bets[p.id] ?? 0,
        folded: Boolean(state.folded[p.id]),
        allIn: Boolean(state.allIn[p.id]),
        active: (state.chips[p.id] ?? 0) > 0 || !state.folded[p.id],
        revealedCards:
          state.street === 'finished' && !state.folded[p.id]
            ? [...(state.holeCards[p.id] ?? [])]
            : null,
      })),
      actionLog: state.actionLog,
      isGameOver: this.isGameOver(state),
      result: this.isGameOver(state) ? this.getResult(state) : null,
    };
  },

  isGameOver(state) {
    return state.street === 'finished';
  },

  getResult(state) {
    const reversedElims = [...state.eliminationOrder].reverse();
    const ordered = [...state.winnerIds, ...reversedElims];
    const unique = Array.from(new Set(ordered));
    return {
      winnerIds: [...state.winnerIds],
      rankings: unique.map((id, idx) => ({
        playerId: id,
        rank: idx + 1,
        score: state.chips[id] ?? 0,
      })),
      summary: 'Kết thúc bàn Poker',
    };
  },
};
