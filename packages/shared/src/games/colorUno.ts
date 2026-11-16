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
}

export interface ColorUnoState {
  players: GamePlayer[];
  deck: UnoCard[];
  discardPile: UnoCard[];
  hands: Record<string, UnoCard[]>;
  activeColor: UnoColor;
  direction: 1 | -1;
  turnIndex: number;
  drawnCardId: string | null;
  lastCardCalled: Record<string, boolean>;
  phase: 'playing' | 'finished';
  winnerIds: string[];
  actionLog: GameActionLogEntry[];
}

export type ColorUnoAction =
  | { type: 'PLAY_CARD'; cardId: string; chosenColor?: UnoColor }
  | { type: 'DRAW_CARD' }
  | { type: 'PASS_TURN' }
  | { type: 'CALL_LAST_CARD' }
  | { type: 'CATCH_LAST_CARD'; targetId: string };

export interface ColorUnoPlayerView {
  gameId: 'color-uno';
  phase: 'playing' | 'finished';
  currentTurnPlayerId: string | null;
  myPlayerId: string;
  myHand: UnoCard[];
  topCard: UnoCard;
  activeColor: UnoColor;
  direction: 1 | -1;
  deckCount: number;
  drawnCardId: string | null;
  legalActions: ColorUnoAction[];
  players: Array<{
    id: string;
    username: string;
    avatarId: string;
    cardCount: number;
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

function isCardPlayable(card: UnoCard, topCard: UnoCard, activeColor: UnoColor): boolean {
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
      throw new Error('Sắc Màu Vui Nhộn cần từ 2 đến 10 người chơi');
    }

    const rng = options?.rng ?? Math.random;
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

    // Pick a clean non-wild starting card
    let startIdx = deck.length - 1;
    while (startIdx >= 0 && deck[startIdx]!.color === 'wild') {
      startIdx--;
    }
    const startCard = startIdx >= 0 ? deck.splice(startIdx, 1)[0]! : deck.pop()!;
    const activeColor: UnoColor = startCard.color === 'wild' ? 'red' : startCard.color;

    return {
      players: [...players],
      deck,
      discardPile: [startCard],
      hands,
      activeColor,
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled,
      phase: 'playing',
      winnerIds: [],
      actionLog: [
        {
          id: 'start',
          text: `Ván Sắc Màu Vui Nhộn bắt đầu! Lá mở màn: ${formatUnoCardLabel(startCard)} (${UNO_COLOR_LABELS[activeColor]}).`,
          timestamp: Date.now(),
        },
      ],
    };
  },

  getLegalActions(state, playerId) {
    if (state.phase !== 'playing') return [];

    const actions: ColorUnoAction[] = [];
    const myHand = state.hands[playerId] ?? [];

    // Out-of-turn / anytime last-card call or catch
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
      if (drawnCard && isCardPlayable(drawnCard, topCard, state.activeColor)) {
        if (drawnCard.color === 'wild') {
          for (const c of UNO_COLORS) {
            actions.push({ type: 'PLAY_CARD', cardId: drawnCard.id, chosenColor: c });
          }
        } else {
          actions.push({ type: 'PLAY_CARD', cardId: drawnCard.id });
        }
      }
      actions.push({ type: 'PASS_TURN' });
      return actions;
    }

    for (const card of myHand) {
      if (isCardPlayable(card, topCard, state.activeColor)) {
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
    const isLegal = legal.some((a) => {
      if (a.type !== action.type) return false;
      if (a.type === 'PLAY_CARD' && action.type === 'PLAY_CARD') {
        return a.cardId === action.cardId && a.chosenColor === action.chosenColor;
      }
      if (a.type === 'CATCH_LAST_CARD' && action.type === 'CATCH_LAST_CARD') {
        return a.targetId === action.targetId;
      }
      return true;
    });

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
      return {
        ...state,
        lastCardCalled: nextLastCardCalled,
        actionLog: nextLog,
      };
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
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} không còn bài để rút, chuyển lượt.`,
          timestamp: Date.now(),
        });
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
      if (isCardPlayable(drawnCard, topCard, state.activeColor)) {
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} rút 1 lá (có thể đánh ngay hoặc bỏ qua).`,
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

    // PLAY_CARD
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
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} đã hết bài và giành chiến thắng!`,
        timestamp: Date.now(),
      });
      return {
        ...state,
        discardPile: nextDiscard,
        hands: nextHands,
        activeColor: nextColor,
        drawnCardId: null,
        lastCardCalled: nextLastCardCalled,
        phase: 'finished',
        winnerIds: [playerId],
        actionLog: nextLog,
      };
    }

    let nextDeck = [...state.deck];
    let finalDiscard = nextDiscard;
    let nextDirection = state.direction;
    let step = 1;

    if (played!.kind === 'skip') {
      step = 2;
    } else if (played!.kind === 'reverse') {
      if (state.players.length === 2) {
        // 2-player rule: reverse acts as skip
        step = 2;
      } else {
        nextDirection = (state.direction * -1) as 1 | -1;
      }
    } else if (played!.kind === 'draw_two' || played!.kind === 'wild_draw_four') {
      const drawCount = played!.kind === 'draw_two' ? 2 : 4;
      const victimIdx = advanceIndex(state.turnIndex, 1, nextDirection, state.players.length);
      const victim = state.players[victimIdx]!;
      const drawRes = drawFromDeck(nextDeck, finalDiscard, drawCount);
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

    const nextTurnIndex = advanceIndex(state.turnIndex, step, nextDirection, state.players.length);

    return {
      ...state,
      deck: nextDeck,
      discardPile: finalDiscard,
      hands: nextHands,
      activeColor: nextColor,
      direction: nextDirection,
      turnIndex: nextTurnIndex,
      drawnCardId: null,
      lastCardCalled: nextLastCardCalled,
      actionLog: nextLog,
    };
  },

  getPlayerView(state, playerId) {
    const currentTurnPlayerId =
      state.phase === 'playing' ? (state.players[state.turnIndex]?.id ?? null) : null;

    return {
      gameId: 'color-uno',
      phase: state.phase,
      currentTurnPlayerId,
      myPlayerId: playerId,
      myHand: [...(state.hands[playerId] ?? [])],
      topCard: state.discardPile[state.discardPile.length - 1]!,
      activeColor: state.activeColor,
      direction: state.direction,
      deckCount: state.deck.length,
      drawnCardId: currentTurnPlayerId === playerId ? state.drawnCardId : null,
      legalActions: this.getLegalActions(state, playerId),
      players: state.players.map((p) => ({
        id: p.id,
        username: p.username,
        avatarId: p.avatarId,
        cardCount: state.hands[p.id]?.length ?? 0,
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
    const handPoints: Record<string, number> = {};
    let totalOpponentPoints = 0;

    for (const p of state.players) {
      const pts = (state.hands[p.id] ?? []).reduce((sum, c) => sum + getCardPoints(c), 0);
      handPoints[p.id] = pts;
      if (!state.winnerIds.includes(p.id)) {
        totalOpponentPoints += pts;
      }
    }

    const sorted = [...state.players].sort((a, b) => {
      if (state.winnerIds.includes(a.id)) return -1;
      if (state.winnerIds.includes(b.id)) return 1;
      return (handPoints[a.id] ?? 0) - (handPoints[b.id] ?? 0);
    });

    return {
      winnerIds: [...state.winnerIds],
      rankings: sorted.map((p, idx) => ({
        playerId: p.id,
        rank: idx + 1,
        score: state.winnerIds.includes(p.id) ? totalOpponentPoints : handPoints[p.id] ?? 0,
      })),
      summary: 'Kết thúc ván Sắc Màu Vui Nhộn',
    };
  },
};
