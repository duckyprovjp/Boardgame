import type { GameActionLogEntry, GameModule, GamePlayer, GameResult } from '../game';

export type MeoNoCardKind =
  | 'bomb'
  | 'defuse'
  | 'skip'
  | 'attack'
  | 'see_future'
  | 'shuffle'
  | 'favor'
  | 'nope'
  | 'combo_watermelon'
  | 'combo_potato'
  | 'combo_rainbow';

export interface MeoNoCard {
  id: string;
  kind: MeoNoCardKind;
}

export interface MeoNoCardMeta {
  kind: MeoNoCardKind;
  name: string;
  emoji: string;
  description: string;
}

export const MEO_NO_CARDS: Record<MeoNoCardKind, MeoNoCardMeta> = {
  bomb: { kind: 'bomb', name: 'Mèo Bom', emoji: '💣', description: 'Rút trúng sẽ bị loại nếu không có Gỡ Bom' },
  defuse: { kind: 'defuse', name: 'Gỡ Bom', emoji: '🛠️', description: 'Vô hiệu hoá Mèo Bom và đặt lại vào nọc' },
  skip: { kind: 'skip', name: 'Né Lượt', emoji: '💨', description: 'Kết thúc lượt ngay mà không cần rút bài' },
  attack: { kind: 'attack', name: 'Tấn Công x2', emoji: '⚡', description: 'Không cần rút bài, người kế tiếp đi 2 lượt (cộng dồn)' },
  see_future: { kind: 'see_future', name: 'Soi Tương Lai', emoji: '🔮', description: 'Xem bí mật 3 lá trên cùng của nọc' },
  shuffle: { kind: 'shuffle', name: 'Xào Bài', emoji: '🔀', description: 'Xào ngẫu nhiên toàn bộ nọc bài' },
  favor: { kind: 'favor', name: 'Xin Xỏ', emoji: '🙏', description: 'Yêu cầu 1 người chơi khác tặng bạn 1 lá bài' },
  nope: { kind: 'nope', name: 'Chặn Đòn', emoji: '✋', description: 'Huỷ bỏ hành động vừa đánh (có thể chặn chồng)' },
  combo_watermelon: { kind: 'combo_watermelon', name: 'Mèo Dưa Hấu', emoji: '🍉', description: 'Đánh 2 lá giống nhau để cướp 1 lá ngẫu nhiên' },
  combo_potato: { kind: 'combo_potato', name: 'Mèo Khoai Tây', emoji: '🥔', description: 'Đánh 2 lá giống nhau để cướp 1 lá ngẫu nhiên' },
  combo_rainbow: { kind: 'combo_rainbow', name: 'Mèo Cầu Vồng', emoji: '🌈', description: 'Đánh 2 lá giống nhau để cướp 1 lá ngẫu nhiên' },
};

export interface MeoNoOptions {
  rng?: () => number;
}

export interface PendingMeoNoAction {
  actorId: string;
  kind: 'skip' | 'attack' | 'see_future' | 'shuffle' | 'favor' | 'pair';
  targetId?: string;
  nopeCount: number;
  passedPlayerIds: string[];
}

export interface MeoNoState {
  players: GamePlayer[];
  alive: Record<string, boolean>;
  eliminationOrder: string[];
  deck: MeoNoCard[];
  discardPile: MeoNoCard[];
  hands: Record<string, MeoNoCard[]>;
  turnIndex: number;
  turnsRemaining: number;
  phase: 'playing' | 'nope_window' | 'defuse_pending' | 'favor_pending' | 'finished';
  pendingAction: PendingMeoNoAction | null;
  pendingBombCard: MeoNoCard | null;
  defusingPlayerId: string | null;
  favorRequesterId: string | null;
  favorTargetId: string | null;
  peekedByPlayer: Record<string, MeoNoCard[] | null>;
  winnerIds: string[];
  actionLog: GameActionLogEntry[];
}

export type MeoNoAction =
  | { type: 'PLAY_CARD'; cardId: string; targetId?: string }
  | { type: 'PLAY_PAIR'; cardKind: 'combo_watermelon' | 'combo_potato' | 'combo_rainbow'; targetId: string }
  | { type: 'DRAW_CARD' }
  | { type: 'PLAY_NOPE'; cardId: string }
  | { type: 'PASS_NOPE' }
  | { type: 'DEFUSE_INSERT'; position: number }
  | { type: 'GIVE_FAVOR'; cardId: string };

export interface MeoNoPlayerView {
  gameId: 'meo-no';
  phase: MeoNoState['phase'];
  currentTurnPlayerId: string | null;
  activeTurnPlayerId: string | null;
  turnsRemaining: number;
  myPlayerId: string;
  myHand: MeoNoCard[];
  deckCount: number;
  topDiscard: MeoNoCard | null;
  peekedTop3: MeoNoCard[] | null;
  pendingAction: PendingMeoNoAction | null;
  defusingPlayerId: string | null;
  favorTargetId: string | null;
  legalActions: MeoNoAction[];
  players: Array<{
    id: string;
    username: string;
    avatarId: string;
    alive: boolean;
    cardCount: number;
  }>;
  actionLog: GameActionLogEntry[];
  isGameOver: boolean;
  result: GameResult | null;
}

const COMBO_KINDS = ['combo_watermelon', 'combo_potato', 'combo_rainbow'] as const;

function shuffleCards(cards: MeoNoCard[], rng: () => number = Math.random): MeoNoCard[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function nextAliveIndex(players: GamePlayer[], alive: Record<string, boolean>, fromIndex: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (alive[players[idx]!.id]) return idx;
  }
  return fromIndex;
}

function getAlivePlayerIds(state: MeoNoState): string[] {
  return state.players.filter((p) => state.alive[p.id]).map((p) => p.id);
}

function advanceTurn(state: MeoNoState): { turnIndex: number; turnsRemaining: number } {
  if (state.turnsRemaining > 1) {
    return { turnIndex: state.turnIndex, turnsRemaining: state.turnsRemaining - 1 };
  }
  return {
    turnIndex: nextAliveIndex(state.players, state.alive, state.turnIndex),
    turnsRemaining: 1,
  };
}

function executePendingAction(state: MeoNoState, rng: () => number = Math.random): MeoNoState {
  const pending = state.pendingAction;
  if (!pending) return { ...state, phase: 'playing' };

  const actor = state.players.find((p) => p.id === pending.actorId)!;
  const nextLog = [...state.actionLog];

  if (pending.nopeCount % 2 === 1) {
    nextLog.push({
      id: `${Date.now()}-${nextLog.length}`,
      text: `Hành động của ${actor.username} đã bị Chặn Đòn!`,
      timestamp: Date.now(),
    });
    return {
      ...state,
      phase: 'playing',
      pendingAction: null,
      actionLog: nextLog,
    };
  }

  let nextDeck = [...state.deck];
  const nextHands: Record<string, MeoNoCard[]> = {};
  for (const [k, v] of Object.entries(state.hands)) {
    nextHands[k] = [...v];
  }
  const nextPeeked = { ...state.peekedByPlayer };
  let nextTurnIndex = state.turnIndex;
  let nextTurnsRemaining = state.turnsRemaining;
  let nextPhase: MeoNoState['phase'] = 'playing';
  let favorRequesterId: string | null = null;
  let favorTargetId: string | null = null;

  switch (pending.kind) {
    case 'skip': {
      const adv = advanceTurn(state);
      nextTurnIndex = adv.turnIndex;
      nextTurnsRemaining = adv.turnsRemaining;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} né lượt thành công.`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'attack': {
      const extraTurns = state.turnsRemaining > 1 ? state.turnsRemaining + 2 : 2;
      nextTurnIndex = nextAliveIndex(state.players, state.alive, state.turnIndex);
      nextTurnsRemaining = extraTurns;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} tấn công! ${state.players[nextTurnIndex]!.username} phải đi ${extraTurns} lượt.`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'see_future': {
      const top3 = nextDeck.slice(-3).reverse();
      nextPeeked[actor.id] = top3;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} đã soi 3 lá trên cùng của nọc.`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'shuffle': {
      nextDeck = shuffleCards(nextDeck, rng);
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} đã xào lại nọc bài.`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'favor': {
      const targetHand = nextHands[pending.targetId ?? ''] ?? [];
      if (pending.targetId && targetHand.length > 0) {
        nextPhase = 'favor_pending';
        favorRequesterId = actor.id;
        favorTargetId = pending.targetId;
      } else {
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} xin xỏ nhưng đối thủ không có bài.`,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'pair': {
      const targetId = pending.targetId ?? '';
      const targetHand = nextHands[targetId] ?? [];
      if (targetId && targetHand.length > 0) {
        const idx = Math.floor(rng() * targetHand.length);
        const [stolen] = targetHand.splice(idx, 1);
        nextHands[actor.id]!.push(stolen!);
        const target = state.players.find((p) => p.id === targetId)!;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} dùng cặp bài cướp 1 lá từ ${target.username}.`,
          timestamp: Date.now(),
        });
      }
      break;
    }
  }

  return {
    ...state,
    deck: nextDeck,
    hands: nextHands,
    peekedByPlayer: nextPeeked,
    turnIndex: nextTurnIndex,
    turnsRemaining: nextTurnsRemaining,
    phase: nextPhase,
    pendingAction: null,
    favorRequesterId,
    favorTargetId,
    actionLog: nextLog,
  };
}

export const MeoNoGame: GameModule<MeoNoState, MeoNoAction, MeoNoPlayerView, MeoNoOptions> = {
  id: 'meo-no',
  minPlayers: 2,
  maxPlayers: 5,

  setup(players, options) {
    if (players.length < 2 || players.length > 5) {
      throw new Error('Mèo Nổ cần từ 2 đến 5 người chơi');
    }

    const rng = options?.rng ?? Math.random;
    let seq = 1;
    const makeCard = (kind: MeoNoCardKind): MeoNoCard => ({ id: `mn_${seq++}`, kind });

    const baseCards: MeoNoCard[] = [];
    for (let i = 0; i < 4; i++) baseCards.push(makeCard('skip'));
    for (let i = 0; i < 4; i++) baseCards.push(makeCard('attack'));
    for (let i = 0; i < 5; i++) baseCards.push(makeCard('see_future'));
    for (let i = 0; i < 4; i++) baseCards.push(makeCard('shuffle'));
    for (let i = 0; i < 4; i++) baseCards.push(makeCard('favor'));
    for (let i = 0; i < 5; i++) baseCards.push(makeCard('nope'));
    for (let i = 0; i < 4; i++) baseCards.push(makeCard('combo_watermelon'));
    for (let i = 0; i < 4; i++) baseCards.push(makeCard('combo_potato'));
    for (let i = 0; i < 4; i++) baseCards.push(makeCard('combo_rainbow'));

    const shuffledBase = shuffleCards(baseCards, rng);
    const hands: Record<string, MeoNoCard[]> = {};
    const alive: Record<string, boolean> = {};
    const peekedByPlayer: Record<string, MeoNoCard[] | null> = {};

    for (const p of players) {
      alive[p.id] = true;
      peekedByPlayer[p.id] = null;
      hands[p.id] = [makeCard('defuse')];
      for (let i = 0; i < 4; i++) {
        hands[p.id]!.push(shuffledBase.pop()!);
      }
    }

    // Add (players - 1) bombs and extra defuse cards into the deck
    const extraDefuses = Math.max(1, 6 - players.length);
    for (let i = 0; i < extraDefuses; i++) {
      shuffledBase.push(makeCard('defuse'));
    }
    for (let i = 0; i < players.length - 1; i++) {
      shuffledBase.push(makeCard('bomb'));
    }

    const deck = shuffleCards(shuffledBase, rng);

    return {
      players: [...players],
      alive,
      eliminationOrder: [],
      deck,
      discardPile: [],
      hands,
      turnIndex: 0,
      turnsRemaining: 1,
      phase: 'playing',
      pendingAction: null,
      pendingBombCard: null,
      defusingPlayerId: null,
      favorRequesterId: null,
      favorTargetId: null,
      peekedByPlayer,
      winnerIds: [],
      actionLog: [
        {
          id: 'start',
          text: `Ván Mèo Nổ bắt đầu với ${players.length} người chơi (${players.length - 1} lá Mèo Bom trong nọc).`,
          timestamp: Date.now(),
        },
      ],
    };
  },

  getLegalActions(state, playerId) {
    if (state.phase === 'finished' || !state.alive[playerId]) return [];

    const hand = state.hands[playerId] ?? [];

    if (state.phase === 'defuse_pending') {
      if (state.defusingPlayerId !== playerId) return [];
      const actions: MeoNoAction[] = [];
      for (let pos = 0; pos <= state.deck.length; pos++) {
        actions.push({ type: 'DEFUSE_INSERT', position: pos });
      }
      return actions;
    }

    if (state.phase === 'favor_pending') {
      if (state.favorTargetId !== playerId) return [];
      return hand.map((c) => ({ type: 'GIVE_FAVOR', cardId: c.id }));
    }

    if (state.phase === 'nope_window') {
      const pending = state.pendingAction;
      if (!pending) return [];
      const actions: MeoNoAction[] = [];
      for (const c of hand) {
        if (c.kind === 'nope') {
          actions.push({ type: 'PLAY_NOPE', cardId: c.id });
        }
      }
      if (!pending.passedPlayerIds.includes(playerId)) {
        actions.push({ type: 'PASS_NOPE' });
      }
      return actions;
    }

    // phase === 'playing'
    const current = state.players[state.turnIndex];
    if (!current || current.id !== playerId) return [];

    const actions: MeoNoAction[] = [{ type: 'DRAW_CARD' }];
    const otherAliveWithCards = state.players.filter(
      (p) => p.id !== playerId && state.alive[p.id] && (state.hands[p.id]?.length ?? 0) > 0,
    );

    for (const card of hand) {
      if (
        card.kind === 'skip' ||
        card.kind === 'attack' ||
        card.kind === 'see_future' ||
        card.kind === 'shuffle'
      ) {
        actions.push({ type: 'PLAY_CARD', cardId: card.id });
      } else if (card.kind === 'favor') {
        for (const target of otherAliveWithCards) {
          actions.push({ type: 'PLAY_CARD', cardId: card.id, targetId: target.id });
        }
      }
    }

    for (const comboKind of COMBO_KINDS) {
      const count = hand.filter((c) => c.kind === comboKind).length;
      if (count >= 2) {
        for (const target of otherAliveWithCards) {
          actions.push({ type: 'PLAY_PAIR', cardKind: comboKind, targetId: target.id });
        }
      }
    }

    return actions;
  },

  applyAction(state, playerId, action) {
    const legal = this.getLegalActions(state, playerId);
    const isLegal = legal.some((a) => JSON.stringify(a) === JSON.stringify(action));
    if (!isLegal) {
      throw new Error('Hành động không hợp lệ');
    }

    const actor = state.players.find((p) => p.id === playerId)!;
    const nextHands: Record<string, MeoNoCard[]> = {};
    for (const [k, v] of Object.entries(state.hands)) {
      nextHands[k] = [...v];
    }
    const nextLog = [...state.actionLog];
    const nextDiscard = [...state.discardPile];

    if (action.type === 'DEFUSE_INSERT') {
      const hand = nextHands[playerId]!;
      const defuseIdx = hand.findIndex((c) => c.kind === 'defuse');
      const [defuseCard] = hand.splice(defuseIdx, 1);
      if (defuseCard) nextDiscard.push(defuseCard);

      const nextDeck = [...state.deck];
      // position 0 = top of deck (end of array)
      const insertIdx = Math.max(0, Math.min(nextDeck.length, nextDeck.length - action.position));
      nextDeck.splice(insertIdx, 0, state.pendingBombCard!);

      const adv = advanceTurn(state);
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} đã gỡ Mèo Bom và giấu lại vào nọc!`,
        timestamp: Date.now(),
      });

      return {
        ...state,
        deck: nextDeck,
        discardPile: nextDiscard,
        hands: nextHands,
        pendingBombCard: null,
        defusingPlayerId: null,
        phase: 'playing',
        turnIndex: adv.turnIndex,
        turnsRemaining: adv.turnsRemaining,
        actionLog: nextLog,
      };
    }

    if (action.type === 'GIVE_FAVOR') {
      const hand = nextHands[playerId]!;
      const idx = hand.findIndex((c) => c.id === action.cardId);
      const [given] = hand.splice(idx, 1);
      nextHands[state.favorRequesterId!]!.push(given!);
      const requester = state.players.find((p) => p.id === state.favorRequesterId)!;

      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} đã tặng 1 lá bài cho ${requester.username}.`,
        timestamp: Date.now(),
      });

      return {
        ...state,
        hands: nextHands,
        phase: 'playing',
        favorRequesterId: null,
        favorTargetId: null,
        actionLog: nextLog,
      };
    }

    if (action.type === 'PLAY_NOPE') {
      const hand = nextHands[playerId]!;
      const idx = hand.findIndex((c) => c.id === action.cardId);
      const [nopeCard] = hand.splice(idx, 1);
      nextDiscard.push(nopeCard!);

      const nextNopeCount = (state.pendingAction?.nopeCount ?? 0) + 1;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} đánh Chặn Đòn! (Chuỗi chặn: ${nextNopeCount})`,
        timestamp: Date.now(),
      });

      return {
        ...state,
        discardPile: nextDiscard,
        hands: nextHands,
        pendingAction: {
          ...state.pendingAction!,
          nopeCount: nextNopeCount,
          passedPlayerIds: [playerId],
        },
        actionLog: nextLog,
      };
    }

    if (action.type === 'PASS_NOPE') {
      const passed = [...state.pendingAction!.passedPlayerIds, playerId];
      const aliveIds = getAlivePlayerIds(state);
      const allPassed = aliveIds.every((id) => passed.includes(id));

      const updated: MeoNoState = {
        ...state,
        pendingAction: {
          ...state.pendingAction!,
          passedPlayerIds: passed,
        },
      };

      if (allPassed) {
        return executePendingAction(updated);
      }
      return updated;
    }

    if (action.type === 'PLAY_CARD') {
      const hand = nextHands[playerId]!;
      const idx = hand.findIndex((c) => c.id === action.cardId);
      const [played] = hand.splice(idx, 1);
      nextDiscard.push(played!);

      const kind = played!.kind as PendingMeoNoAction['kind'];
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} đánh lá ${MEO_NO_CARDS[played!.kind].name}.`,
        timestamp: Date.now(),
      });

      return {
        ...state,
        discardPile: nextDiscard,
        hands: nextHands,
        phase: 'nope_window',
        pendingAction: {
          actorId: playerId,
          kind,
          targetId: action.targetId,
          nopeCount: 0,
          passedPlayerIds: [playerId],
        },
        actionLog: nextLog,
      };
    }

    if (action.type === 'PLAY_PAIR') {
      const hand = nextHands[playerId]!;
      let removed = 0;
      nextHands[playerId] = hand.filter((c) => {
        if (c.kind === action.cardKind && removed < 2) {
          removed++;
          nextDiscard.push(c);
          return false;
        }
        return true;
      });

      const target = state.players.find((p) => p.id === action.targetId)!;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} đánh cặp ${MEO_NO_CARDS[action.cardKind].name} nhắm vào ${target.username}.`,
        timestamp: Date.now(),
      });

      return {
        ...state,
        discardPile: nextDiscard,
        hands: nextHands,
        phase: 'nope_window',
        pendingAction: {
          actorId: playerId,
          kind: 'pair',
          targetId: action.targetId,
          nopeCount: 0,
          passedPlayerIds: [playerId],
        },
        actionLog: nextLog,
      };
    }

    // DRAW_CARD
    const nextDeck = [...state.deck];
    const drawn = nextDeck.pop();
    const nextPeeked = { ...state.peekedByPlayer, [playerId]: null };

    if (!drawn) {
      const adv = advanceTurn(state);
      return {
        ...state,
        peekedByPlayer: nextPeeked,
        turnIndex: adv.turnIndex,
        turnsRemaining: adv.turnsRemaining,
      };
    }

    if (drawn.kind === 'bomb') {
      const hasDefuse = nextHands[playerId]!.some((c) => c.kind === 'defuse');
      if (hasDefuse) {
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} rút trúng Mèo Bom 💣 và đang dùng Gỡ Bom!`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          deck: nextDeck,
          peekedByPlayer: nextPeeked,
          phase: 'defuse_pending',
          pendingBombCard: drawn,
          defusingPlayerId: playerId,
          actionLog: nextLog,
        };
      }

      // Eliminated!
      const nextAlive = { ...state.alive, [playerId]: false };
      nextDiscard.push(drawn, ...nextHands[playerId]!);
      nextHands[playerId] = [];
      const nextElimOrder = [...state.eliminationOrder, playerId];

      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `💥 ${actor.username} rút trúng Mèo Bom và bị loại!`,
        timestamp: Date.now(),
      });

      const survivors = state.players.filter((p) => nextAlive[p.id]);
      if (survivors.length === 1) {
        const winner = survivors[0]!;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `🏆 ${winner.username} là người sống sót cuối cùng và chiến thắng!`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          alive: nextAlive,
          eliminationOrder: nextElimOrder,
          deck: nextDeck,
          discardPile: nextDiscard,
          hands: nextHands,
          peekedByPlayer: nextPeeked,
          phase: 'finished',
          winnerIds: [winner.id],
          actionLog: nextLog,
        };
      }

      const nextTurnIndex = nextAliveIndex(state.players, nextAlive, state.turnIndex);
      return {
        ...state,
        alive: nextAlive,
        eliminationOrder: nextElimOrder,
        deck: nextDeck,
        discardPile: nextDiscard,
        hands: nextHands,
        peekedByPlayer: nextPeeked,
        turnIndex: nextTurnIndex,
        turnsRemaining: 1,
        actionLog: nextLog,
      };
    }

    // Safe card drawn
    nextHands[playerId]!.push(drawn);
    const adv = advanceTurn(state);
    nextLog.push({
      id: `${Date.now()}-${nextLog.length}`,
      text: `${actor.username} rút 1 lá an toàn và kết thúc lượt.`,
      timestamp: Date.now(),
    });

    return {
      ...state,
      deck: nextDeck,
      hands: nextHands,
      peekedByPlayer: nextPeeked,
      turnIndex: adv.turnIndex,
      turnsRemaining: adv.turnsRemaining,
      actionLog: nextLog,
    };
  },

  getPlayerView(state, playerId) {
    let currentTurnPlayerId: string | null = null;
    if (state.phase === 'playing') {
      currentTurnPlayerId = state.players[state.turnIndex]?.id ?? null;
    } else if (state.phase === 'defuse_pending') {
      currentTurnPlayerId = state.defusingPlayerId;
    } else if (state.phase === 'favor_pending') {
      currentTurnPlayerId = state.favorTargetId;
    } else if (state.phase === 'nope_window' && state.pendingAction) {
      const nextResponder = state.players.find(
        (p) => state.alive[p.id] && !state.pendingAction!.passedPlayerIds.includes(p.id),
      );
      currentTurnPlayerId = nextResponder?.id ?? null;
    }

    return {
      gameId: 'meo-no',
      phase: state.phase,
      currentTurnPlayerId,
      activeTurnPlayerId: state.phase !== 'finished' ? (state.players[state.turnIndex]?.id ?? null) : null,
      turnsRemaining: state.turnsRemaining,
      myPlayerId: playerId,
      myHand: [...(state.hands[playerId] ?? [])],
      deckCount: state.deck.length,
      topDiscard: state.discardPile[state.discardPile.length - 1] ?? null,
      // Privacy: only the player who played see_future sees peekedTop3!
      peekedTop3: state.peekedByPlayer[playerId] ?? null,
      pendingAction: state.pendingAction,
      defusingPlayerId: state.defusingPlayerId,
      favorTargetId: state.favorTargetId,
      legalActions: this.getLegalActions(state, playerId),
      players: state.players.map((p) => ({
        id: p.id,
        username: p.username,
        avatarId: p.avatarId,
        alive: Boolean(state.alive[p.id]),
        cardCount: state.hands[p.id]?.length ?? 0,
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
    const reversedElims = [...state.eliminationOrder].reverse();
    const orderedIds = [...state.winnerIds, ...reversedElims];
    return {
      winnerIds: [...state.winnerIds],
      rankings: orderedIds.map((id, idx) => ({
        playerId: id,
        rank: idx + 1,
      })),
      summary: 'Kết thúc ván Mèo Nổ',
    };
  },
};
