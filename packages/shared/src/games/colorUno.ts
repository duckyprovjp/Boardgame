import type { GameActionLogEntry, GameModule, GamePlayer, GameResult } from '../game';

export type UnoColor = 'red' | 'blue' | 'green' | 'yellow';
export type UnoCardKind =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw_two'
  | 'wild'
  | 'wild_draw_four';

export interface UnoCard {
  id: string;
  color: UnoColor | 'wild';
  kind: UnoCardKind;
}

export interface ColorUnoOptions {
  rng?: () => number;
  roundsMode?: 'single' | '500';
  turnTimerSec?: number;
  stackDrawCards?: boolean;
  forcedPlayAfterDraw?: boolean;
}

export interface Wd4ChallengeState {
  offenderId: string;
  victimId: string;
  prevColor: UnoColor;
  wasLegal: boolean;
}

export interface ColorUnoState {
  players: GamePlayer[];
  deck: UnoCard[];
  discardPile: UnoCard[];
  hands: Record<string, UnoCard[]>;
  scores: Record<string, number>;
  roundNumber: number;
  roundsMode: 'single' | '500';
  stackDrawCards: boolean;
  forcedPlayAfterDraw: boolean;
  pendingDrawCount: number;
  activeColor: UnoColor;
  direction: 1 | -1;
  turnIndex: number;
  drawnCardId: string | null;
  lastCardCalled: Record<string, boolean>;
  wd4Challenge: Wd4ChallengeState | null;
  phase: 'playing' | 'wd4_challenge' | 'finished';
  winnerIds: string[];
  actionLog: GameActionLogEntry[];
}

export type ColorUnoAction =
  | { type: 'PLAY_CARD'; cardId: string; chosenColor?: UnoColor }
  | { type: 'DRAW_CARD' }
  | { type: 'PASS_TURN' }
  | { type: 'CALL_LAST_CARD' }
  | { type: 'CATCH_LAST_CARD'; targetId: string }
  | { type: 'CHALLENGE_WD4' }
  | { type: 'DECLINE_WD4' };

export interface ColorUnoPlayerView {
  gameId: 'color-uno';
  phase: 'playing' | 'wd4_challenge' | 'finished';
  roundNumber: number;
  roundsMode: 'single' | '500';
  pendingDrawCount: number;
  currentTurnPlayerId: string | null;
  myPlayerId: string;
  myHand: UnoCard[];
  topCard: UnoCard;
  recentDiscard: UnoCard[];
  activeColor: UnoColor;
  direction: 1 | -1;
  deckCount: number;
  drawnCardId: string | null;
  wd4Prompt: { offenderUsername: string; victimId: string } | null;
  legalActions: ColorUnoAction[];
  players: Array<{
    id: string;
    username: string;
    avatarId: string;
    level: number;
    cardCount: number;
    score: number;
    calledLastCard: boolean;
  }>;
  actionLog: GameActionLogEntry[];
  isGameOver: boolean;
  result: GameResult | null;
}

export const UNO_COLORS: readonly UnoColor[] = ['red', 'blue', 'green', 'yellow'];

export const UNO_COLOR_LABELS: Record<UnoColor, string> = {
  red: 'Đỏ',
  blue: 'Xanh dương',
  green: 'Xanh lá',
  yellow: 'Vàng',
};

export function formatUnoCardLabel(card: UnoCard): string {
  switch (card.kind) {
    case 'skip':
      return 'Mất Lượt';
    case 'reverse':
      return 'Đảo Chiều';
    case 'draw_two':
      return 'Rút +2';
    case 'wild':
      return 'Đổi Màu';
    case 'wild_draw_four':
      return 'Đổi Màu +4';
    default:
      return card.kind;
  }
}

export function createUnoDeck(rng: () => number = Math.random): UnoCard[] {
  const deck: UnoCard[] = [];
  let seq = 1;

  for (const color of UNO_COLORS) {
    deck.push({ id: `c_${seq++}`, color, kind: '0' });
    const doubledKinds: UnoCardKind[] = [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'skip',
      'reverse',
      'draw_two',
    ];
    for (const kind of doubledKinds) {
      deck.push({ id: `c_${seq++}`, color, kind });
      deck.push({ id: `c_${seq++}`, color, kind });
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_${seq++}`, color: 'wild', kind: 'wild' });
    deck.push({ id: `c_${seq++}`, color: 'wild', kind: 'wild_draw_four' });
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }

  return deck;
}

function getCardPoints(card: UnoCard): number {
  if (card.kind === 'wild' || card.kind === 'wild_draw_four') return 50;
  if (card.kind === 'skip' || card.kind === 'reverse' || card.kind === 'draw_two') return 20;
  return Number(card.kind);
}

function isCardPlayable(
  card: UnoCard,
  topCard: UnoCard,
  activeColor: UnoColor,
  pendingDrawCount: number,
  stackDrawCards: boolean,
): boolean {
  if (pendingDrawCount > 0 && stackDrawCards) {
    if (topCard.kind === 'draw_two' && card.kind === 'draw_two') return true;
    if (topCard.kind === 'wild_draw_four' && card.kind === 'wild_draw_four') return true;
    return false;
  }
  if (card.color === 'wild') return true;
  if (card.color === activeColor) return true;
  if (card.kind === topCard.kind) return true;
  return false;
}

function drawFromDeck(
  deck: UnoCard[],
  discardPile: UnoCard[],
  count: number,
  rng: () => number = Math.random,
): { drawn: UnoCard[]; deck: UnoCard[]; discardPile: UnoCard[]; reshuffled: boolean } {
  const nextDeck = [...deck];
  let nextDiscard = [...discardPile];
  const drawn: UnoCard[] = [];
  let reshuffled = false;

  for (let i = 0; i < count; i++) {
    if (nextDeck.length === 0) {
      if (nextDiscard.length <= 1) break;
      const top = nextDiscard[nextDiscard.length - 1]!;
      const recyclable = nextDiscard.slice(0, -1);
      for (let j = recyclable.length - 1; j > 0; j--) {
        const k = Math.floor(rng() * (j + 1));
        const tmp = recyclable[j]!;
        recyclable[j] = recyclable[k]!;
        recyclable[k] = tmp;
      }
      nextDeck.push(...recyclable);
      nextDiscard = [top];
      reshuffled = true;
    }
    const card = nextDeck.pop();
    if (card) drawn.push(card);
  }

  return { drawn, deck: nextDeck, discardPile: nextDiscard, reshuffled };
}

function advanceIndex(current: number, steps: number, direction: 1 | -1, total: number): number {
  return (((current + steps * direction) % total) + total) % total;
}

function dealRound(
  players: GamePlayer[],
  scores: Record<string, number>,
  roundNumber: number,
  roundsMode: 'single' | '500',
  stackDrawCards: boolean,
  forcedPlayAfterDraw: boolean,
  actionLog: GameActionLogEntry[],
  rng: () => number = Math.random,
): ColorUnoState {
  const deck = createUnoDeck(rng);
  const hands: Record<string, UnoCard[]> = {};
  const lastCardCalled: Record<string, boolean> = {};

  for (const p of players) {
    hands[p.id] = [];
    lastCardCalled[p.id] = false;
    for (let i = 0; i < 7; i++) {
      hands[p.id]!.push(deck.pop()!);
    }
  }

  // Flip starting card: re-flip if wild_draw_four
  let startCard = deck.pop()!;
  while (startCard.kind === 'wild_draw_four') {
    deck.unshift(startCard);
    startCard = deck.pop()!;
  }

  const activeColor: UnoColor = startCard.color === 'wild' ? 'red' : startCard.color;
  let direction: 1 | -1 = 1;
  let turnIndex = 0;
  let pendingDrawCount = 0;
  const nextLog = [
    ...actionLog,
    {
      id: `round-${roundNumber}-${Date.now()}`,
      text: `Ván #${roundNumber} Bài Sắc Màu bắt đầu! Lá mở màn: ${formatUnoCardLabel(startCard)} (${UNO_COLOR_LABELS[activeColor]}).`,
      timestamp: Date.now(),
    },
  ];

  // Apply starting card effects
  if (startCard.kind === 'skip') {
    nextLog.push({
      id: `start-skip-${Date.now()}`,
      text: `${players[0]!.username} bị mất lượt mở màn!`,
      timestamp: Date.now(),
    });
    turnIndex = advanceIndex(0, 1, direction, players.length);
  } else if (startCard.kind === 'reverse') {
    if (players.length === 2) {
      turnIndex = advanceIndex(0, 1, direction, players.length);
    } else {
      direction = -1;
      turnIndex = players.length - 1;
    }
    nextLog.push({
      id: `start-rev-${Date.now()}`,
      text: `Lá mở màn Đảo Chiều!`,
      timestamp: Date.now(),
    });
  } else if (startCard.kind === 'draw_two') {
    if (stackDrawCards) {
      pendingDrawCount = 2;
    } else {
      const p0 = players[0]!;
      hands[p0.id]!.push(deck.pop()!, deck.pop()!);
      turnIndex = advanceIndex(0, 1, direction, players.length);
      nextLog.push({
        id: `start-d2-${Date.now()}`,
        text: `${p0.username} rút 2 lá từ lá mở màn và mất lượt!`,
        timestamp: Date.now(),
      });
    }
  }

  return {
    players: [...players],
    deck,
    discardPile: [startCard],
    hands,
    scores: { ...scores },
    roundNumber,
    roundsMode,
    stackDrawCards,
    forcedPlayAfterDraw,
    pendingDrawCount,
    activeColor,
    direction,
    turnIndex,
    drawnCardId: null,
    lastCardCalled,
    wd4Challenge: null,
    phase: 'playing',
    winnerIds: [],
    actionLog: nextLog,
  };
}

export const ColorUnoGame: GameModule<
  ColorUnoState,
  ColorUnoAction,
  ColorUnoPlayerView,
  ColorUnoOptions
> = {
  id: 'color-uno',
  minPlayers: 2,
  maxPlayers: 10,

  setup(players, options) {
    if (players.length < 2 || players.length > 10) {
      throw new Error('Bài Sắc Màu cần từ 2 đến 10 người chơi');
    }

    const rng = options?.rng ?? Math.random;
    const roundsMode = options?.roundsMode ?? 'single';
    const stackDrawCards = options?.stackDrawCards ?? false;
    const forcedPlayAfterDraw = options?.forcedPlayAfterDraw ?? false;

    const scores: Record<string, number> = {};
    for (const p of players) {
      scores[p.id] = 0;
    }

    return dealRound(
      players,
      scores,
      1,
      roundsMode,
      stackDrawCards,
      forcedPlayAfterDraw,
      [],
      rng,
    );
  },

  getLegalActions(state, playerId) {
    if (state.phase === 'finished') return [];

    if (state.phase === 'wd4_challenge' && state.wd4Challenge) {
      if (state.wd4Challenge.victimId !== playerId) return [];
      return [{ type: 'CHALLENGE_WD4' }, { type: 'DECLINE_WD4' }];
    }

    const actions: ColorUnoAction[] = [];
    const myHand = state.hands[playerId] ?? [];

    if (myHand.length === 1 && !state.lastCardCalled[playerId]) {
      actions.push({ type: 'CALL_LAST_CARD' });
    }
    for (const p of state.players) {
      if (p.id !== playerId && (state.hands[p.id]?.length ?? 0) === 1 && !state.lastCardCalled[p.id]) {
        actions.push({ type: 'CATCH_LAST_CARD', targetId: p.id });
      }
    }

    const current = state.players[state.turnIndex];
    if (!current || current.id !== playerId) return actions;

    const topCard = state.discardPile[state.discardPile.length - 1]!;

    if (state.drawnCardId) {
      const drawnCard = myHand.find((c) => c.id === state.drawnCardId);
      if (
        drawnCard &&
        isCardPlayable(drawnCard, topCard, state.activeColor, 0, state.stackDrawCards)
      ) {
        if (drawnCard.color === 'wild') {
          for (const c of UNO_COLORS) {
            actions.push({ type: 'PLAY_CARD', cardId: drawnCard.id, chosenColor: c });
          }
        } else {
          actions.push({ type: 'PLAY_CARD', cardId: drawnCard.id });
        }
        if (!state.forcedPlayAfterDraw) {
          actions.push({ type: 'PASS_TURN' });
        }
      } else {
        actions.push({ type: 'PASS_TURN' });
      }
      return actions;
    }

    for (const card of myHand) {
      if (
        isCardPlayable(
          card,
          topCard,
          state.activeColor,
          state.pendingDrawCount,
          state.stackDrawCards,
        )
      ) {
        if (card.color === 'wild') {
          for (const c of UNO_COLORS) {
            actions.push({ type: 'PLAY_CARD', cardId: card.id, chosenColor: c });
          }
        } else {
          actions.push({ type: 'PLAY_CARD', cardId: card.id });
        }
      }
    }

    actions.push({ type: 'DRAW_CARD' });
    return actions;
  },

  applyAction(state, playerId, action) {
    const legal = this.getLegalActions(state, playerId);
    const isLegal = legal.some((a) => JSON.stringify(a) === JSON.stringify(action));
    if (!isLegal) {
      throw new Error('Hành động không hợp lệ');
    }

    const actor = state.players.find((p) => p.id === playerId)!;
    const nextLog = [...state.actionLog];
    const nextHands: Record<string, UnoCard[]> = {};
    for (const [k, v] of Object.entries(state.hands)) {
      nextHands[k] = [...v];
    }
    const nextLastCardCalled = { ...state.lastCardCalled };

    if (action.type === 'CALL_LAST_CARD') {
      nextLastCardCalled[playerId] = true;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} hô: "CÒN 1 LÁ!"`,
        timestamp: Date.now(),
      });
      return { ...state, lastCardCalled: nextLastCardCalled, actionLog: nextLog };
    }

    if (action.type === 'CATCH_LAST_CARD') {
      const target = state.players.find((p) => p.id === action.targetId)!;
      const res = drawFromDeck(state.deck, state.discardPile, 2);
      nextHands[action.targetId]!.push(...res.drawn);
      nextLastCardCalled[action.targetId] = false;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} bắt lỗi ${target.username} quên hô còn 1 lá! (+2 lá phạt)`,
        timestamp: Date.now(),
      });
      return {
        ...state,
        deck: res.deck,
        discardPile: res.discardPile,
        hands: nextHands,
        lastCardCalled: nextLastCardCalled,
        actionLog: nextLog,
      };
    }

    if (action.type === 'DECLINE_WD4' && state.wd4Challenge) {
      const { victimId } = state.wd4Challenge;
      const victim = state.players.find((p) => p.id === victimId)!;
      const drawAmt = state.pendingDrawCount > 0 ? state.pendingDrawCount : 4;
      const res = drawFromDeck(state.deck, state.discardPile, drawAmt);
      nextHands[victimId]!.push(...res.drawn);
      nextLastCardCalled[victimId] = false;
      const nextTurnIndex = advanceIndex(state.turnIndex, 1, state.direction, state.players.length);
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${victim.username} từ chối thách đấu và rút ${res.drawn.length} lá.`,
        timestamp: Date.now(),
      });
      return {
        ...state,
        deck: res.deck,
        discardPile: res.discardPile,
        hands: nextHands,
        lastCardCalled: nextLastCardCalled,
        pendingDrawCount: 0,
        wd4Challenge: null,
        phase: 'playing',
        turnIndex: nextTurnIndex,
        actionLog: nextLog,
      };
    }

    if (action.type === 'CHALLENGE_WD4' && state.wd4Challenge) {
      const { offenderId, victimId, wasLegal } = state.wd4Challenge;
      const offender = state.players.find((p) => p.id === offenderId)!;
      const victim = state.players.find((p) => p.id === victimId)!;

      if (!wasLegal) {
        // Challenge succeeded! Offender held prevColor -> offender draws 4, victim keeps turn
        const res = drawFromDeck(state.deck, state.discardPile, 4);
        nextHands[offenderId]!.push(...res.drawn);
        nextLastCardCalled[offenderId] = false;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${victim.username} thách đấu THÀNH CÔNG! ${offender.username} phải rút 4 lá.`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          deck: res.deck,
          discardPile: res.discardPile,
          hands: nextHands,
          lastCardCalled: nextLastCardCalled,
          pendingDrawCount: 0,
          wd4Challenge: null,
          phase: 'playing',
          actionLog: nextLog,
        };
      } else {
        // Challenge failed! Victim draws 6 and loses turn
        const res = drawFromDeck(state.deck, state.discardPile, 6);
        nextHands[victimId]!.push(...res.drawn);
        nextLastCardCalled[victimId] = false;
        const nextTurnIndex = advanceIndex(state.turnIndex, 1, state.direction, state.players.length);
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${victim.username} thách đấu THẤT BẠI! Phải rút 6 lá và mất lượt.`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          deck: res.deck,
          discardPile: res.discardPile,
          hands: nextHands,
          lastCardCalled: nextLastCardCalled,
          pendingDrawCount: 0,
          wd4Challenge: null,
          phase: 'playing',
          turnIndex: nextTurnIndex,
          actionLog: nextLog,
        };
      }
    }

    if (action.type === 'PASS_TURN') {
      const nextTurnIndex = advanceIndex(state.turnIndex, 1, state.direction, state.players.length);
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} bỏ qua lượt.`,
        timestamp: Date.now(),
      });
      return {
        ...state,
        turnIndex: nextTurnIndex,
        drawnCardId: null,
        actionLog: nextLog,
      };
    }

    if (action.type === 'DRAW_CARD') {
      // If pending stacked draw count > 0, player draws all stacked cards and loses turn
      if (state.pendingDrawCount > 0) {
        const res = drawFromDeck(state.deck, state.discardPile, state.pendingDrawCount);
        nextHands[playerId]!.push(...res.drawn);
        nextLastCardCalled[playerId] = false;
        const nextTurnIndex = advanceIndex(state.turnIndex, 1, state.direction, state.players.length);
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} rút ${res.drawn.length} lá cộng dồn và mất lượt.`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          deck: res.deck,
          discardPile: res.discardPile,
          hands: nextHands,
          lastCardCalled: nextLastCardCalled,
          pendingDrawCount: 0,
          turnIndex: nextTurnIndex,
          drawnCardId: null,
          actionLog: nextLog,
        };
      }

      const res = drawFromDeck(state.deck, state.discardPile, 1);
      if (res.reshuffled) {
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: 'Xào lại chồng bài bỏ vào nọc.',
          timestamp: Date.now(),
        });
      }

      if (res.drawn.length === 0) {
        const nextTurnIndex = advanceIndex(state.turnIndex, 1, state.direction, state.players.length);
        return {
          ...state,
          deck: res.deck,
          discardPile: res.discardPile,
          turnIndex: nextTurnIndex,
          drawnCardId: null,
          actionLog: nextLog,
        };
      }

      const drawnCard = res.drawn[0]!;
      nextHands[playerId]!.push(drawnCard);
      nextLastCardCalled[playerId] = false;

      const topCard = res.discardPile[res.discardPile.length - 1]!;
      if (isCardPlayable(drawnCard, topCard, state.activeColor, 0, state.stackDrawCards)) {
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} rút 1 lá.`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          deck: res.deck,
          discardPile: res.discardPile,
          hands: nextHands,
          lastCardCalled: nextLastCardCalled,
          drawnCardId: drawnCard.id,
          actionLog: nextLog,
        };
      }

      const nextTurnIndex = advanceIndex(state.turnIndex, 1, state.direction, state.players.length);
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} rút 1 lá và kết thúc lượt.`,
        timestamp: Date.now(),
      });
      return {
        ...state,
        deck: res.deck,
        discardPile: res.discardPile,
        hands: nextHands,
        lastCardCalled: nextLastCardCalled,
        turnIndex: nextTurnIndex,
        drawnCardId: null,
        actionLog: nextLog,
      };
    }

    if (action.type !== 'PLAY_CARD') {
      return state;
    }

    // PLAY_CARD
    const prevColor = state.activeColor;
    const handBeforePlay = [...nextHands[playerId]!];
    const hand = nextHands[playerId]!;
    const cardIdx = hand.findIndex((c) => c.id === action.cardId);
    const [played] = hand.splice(cardIdx, 1);
    const nextDiscard = [...state.discardPile, played!];
    const nextColor: UnoColor =
      played!.color === 'wild' ? (action.chosenColor ?? 'red') : played!.color;

    if (hand.length !== 1) {
      nextLastCardCalled[playerId] = false;
    }

    nextLog.push({
      id: `${Date.now()}-${nextLog.length}`,
      text: `${actor.username} đánh lá ${formatUnoCardLabel(played!)} (${UNO_COLOR_LABELS[nextColor]}).`,
      timestamp: Date.now(),
    });

    if (hand.length === 0) {
      let roundPoints = 0;
      for (const p of state.players) {
        if (p.id !== playerId) {
          roundPoints += (nextHands[p.id] ?? []).reduce((s, c) => s + getCardPoints(c), 0);
        }
      }
      const nextScores = { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + roundPoints };
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `🏆 ${actor.username} hết bài và ghi ${roundPoints} điểm! (Tổng: ${nextScores[playerId]})`,
        timestamp: Date.now(),
      });

      if (state.roundsMode === 'single' || nextScores[playerId]! >= 500) {
        return {
          ...state,
          discardPile: nextDiscard,
          hands: nextHands,
          scores: nextScores,
          activeColor: nextColor,
          drawnCardId: null,
          lastCardCalled: nextLastCardCalled,
          phase: 'finished',
          winnerIds: [playerId],
          actionLog: nextLog,
        };
      }

      // Deal next round for 500-point race
      return dealRound(
        state.players,
        nextScores,
        state.roundNumber + 1,
        state.roundsMode,
        state.stackDrawCards,
        state.forcedPlayAfterDraw,
        nextLog,
      );
    }

    let nextDeck = [...state.deck];
    let finalDiscard = nextDiscard;
    let nextDirection = state.direction;
    let nextPendingDraw = state.pendingDrawCount;
    let step = 1;

    if (played!.kind === 'skip') {
      step = 2;
    } else if (played!.kind === 'reverse') {
      if (state.players.length === 2) {
        step = 2;
      } else {
        nextDirection = (state.direction * -1) as 1 | -1;
      }
    } else if (played!.kind === 'draw_two') {
      if (state.stackDrawCards) {
        nextPendingDraw += 2;
      } else {
        const victimIdx = advanceIndex(state.turnIndex, 1, nextDirection, state.players.length);
        const victim = state.players[victimIdx]!;
        const drawRes = drawFromDeck(nextDeck, finalDiscard, 2);
        nextDeck = drawRes.deck;
        finalDiscard = drawRes.discardPile;
        nextHands[victim.id]!.push(...drawRes.drawn);
        nextLastCardCalled[victim.id] = false;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${victim.username} phải rút ${drawRes.drawn.length} lá và mất lượt!`,
          timestamp: Date.now(),
        });
        step = 2;
      }
    } else if (played!.kind === 'wild_draw_four') {
      const victimIdx = advanceIndex(state.turnIndex, 1, nextDirection, state.players.length);
      const victim = state.players[victimIdx]!;
      const wasLegal = !handBeforePlay.some((c) => c.id !== played!.id && c.color === prevColor);
      return {
        ...state,
        deck: nextDeck,
        discardPile: finalDiscard,
        hands: nextHands,
        activeColor: nextColor,
        direction: nextDirection,
        turnIndex: victimIdx,
        drawnCardId: null,
        pendingDrawCount: state.stackDrawCards ? nextPendingDraw + 4 : 4,
        lastCardCalled: nextLastCardCalled,
        phase: 'wd4_challenge',
        wd4Challenge: {
          offenderId: playerId,
          victimId: victim.id,
          prevColor,
          wasLegal,
        },
        actionLog: nextLog,
      };
    }

    const nextTurnIndex = advanceIndex(state.turnIndex, step, nextDirection, state.players.length);

    return {
      ...state,
      deck: nextDeck,
      discardPile: finalDiscard,
      hands: nextHands,
      activeColor: nextColor,
      direction: nextDirection,
      pendingDrawCount: nextPendingDraw,
      turnIndex: nextTurnIndex,
      drawnCardId: null,
      lastCardCalled: nextLastCardCalled,
      actionLog: nextLog,
    };
  },

  getPlayerView(state, playerId) {
    let currentTurnPlayerId: string | null = null;
    if (state.phase === 'wd4_challenge' && state.wd4Challenge) {
      currentTurnPlayerId = state.wd4Challenge.victimId;
    } else if (state.phase === 'playing') {
      currentTurnPlayerId = state.players[state.turnIndex]?.id ?? null;
    }

    const offender = state.wd4Challenge
      ? state.players.find((p) => p.id === state.wd4Challenge!.offenderId)
      : undefined;

    return {
      gameId: 'color-uno',
      phase: state.phase,
      roundNumber: state.roundNumber,
      roundsMode: state.roundsMode,
      pendingDrawCount: state.pendingDrawCount,
      currentTurnPlayerId,
      myPlayerId: playerId,
      myHand: [...(state.hands[playerId] ?? [])],
      topCard: state.discardPile[state.discardPile.length - 1]!,
      recentDiscard: state.discardPile.slice(-3),
      activeColor: state.activeColor,
      direction: state.direction,
      deckCount: state.deck.length,
      drawnCardId: currentTurnPlayerId === playerId ? state.drawnCardId : null,
      wd4Prompt:
        state.phase === 'wd4_challenge' && state.wd4Challenge
          ? {
              offenderUsername: offender?.username ?? '',
              victimId: state.wd4Challenge.victimId,
            }
          : null,
      legalActions: this.getLegalActions(state, playerId),
      players: state.players.map((p) => ({
        id: p.id,
        username: p.username,
        avatarId: p.avatarId,
        level: p.level ?? 1,
        cardCount: state.hands[p.id]?.length ?? 0,
        score: state.scores[p.id] ?? 0,
        calledLastCard: Boolean(state.lastCardCalled[p.id]),
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
    const sorted = [...state.players].sort(
      (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0),
    );
    return {
      winnerIds: [...state.winnerIds],
      rankings: sorted.map((p, idx) => ({
        playerId: p.id,
        rank: idx + 1,
        score: state.scores[p.id] ?? 0,
      })),
      summary: 'Kết thúc trận Bài Sắc Màu',
    };
  },
};
