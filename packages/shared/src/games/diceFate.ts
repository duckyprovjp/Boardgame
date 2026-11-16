import defaultRules from '../../games/dice-fate/rules.json';
import type { GameActionLogEntry, GameModule, GamePlayer, GameResult } from '../game';

export type DiceFateDeckColor = 'green' | 'red';

export type DiceFateEffect =
  | { type: 'NOOP' }
  | { type: 'DRAW_CARD'; count: number }
  | { type: 'HEAL'; amount: number }
  | { type: 'ALL_LOSE_LIFE'; amount: number }
  | { type: 'TARGET_LOSE_LIFE'; amount: number }
  | { type: 'BAN_DECK'; deck: DiceFateDeckColor }
  | { type: 'ADD_SHIELD'; amount: number }
  | { type: 'CANCEL_RED' }
  | { type: 'SWAP_CARD_RANDOM' }
  | { type: 'PEEK_HAND' }
  | { type: 'LOSE_LIFE'; amount: number }
  | { type: 'DARE_TEXT'; prompt: string }
  | { type: 'STEAL_CARD' }
  | { type: 'SKIP_NEXT' };

export interface DiceFateDieFace {
  id: string;
  label: string;
  emoji: string;
  description: string;
  effect: DiceFateEffect;
}

export interface DiceFateCardDef {
  id: string;
  deck: DiceFateDeckColor;
  name: string;
  emoji: string;
  description: string;
  copies: number;
  requiresTarget: boolean;
  effect: DiceFateEffect;
}

export interface DiceFateRules {
  startingLives: number;
  maxLives: number;
  startingHandSize: number;
  dieFaces: DiceFateDieFace[];
  cards: DiceFateCardDef[];
}

export interface DiceFateCardInstance {
  instanceId: string;
  defId: string;
  deck: DiceFateDeckColor;
}

export interface DiceFateOptions {
  rng?: () => number;
}

export interface PendingRedCard {
  actorId: string;
  card: DiceFateCardInstance;
  targetId?: string;
  canceled: boolean;
  passedPlayerIds: string[];
}

export interface DiceFateState {
  players: GamePlayer[];
  lives: Record<string, number>;
  shields: Record<string, number>;
  skipNextTurn: Record<string, boolean>;
  eliminationOrder: string[];
  deck: DiceFateCardInstance[];
  discardPile: DiceFateCardInstance[];
  hands: Record<string, DiceFateCardInstance[]>;
  turnIndex: number;
  phase: 'shake_pending' | 'die_target_pending' | 'card_phase' | 'cancel_window' | 'finished';
  lastDieFace: DiceFateDieFace | null;
  pendingDieAmount: number;
  bannedDeck: DiceFateDeckColor | null;
  playedCardThisTurn: boolean;
  pendingRedCard: PendingRedCard | null;
  activeDare: { targetUsername: string; prompt: string } | null;
  peekedByPlayer: Record<string, { targetUsername: string; cards: DiceFateCardInstance[] } | null>;
  winnerIds: string[];
  actionLog: GameActionLogEntry[];
}

export type DiceFateAction =
  | { type: 'SHAKE_DIE' }
  | { type: 'CHOOSE_DIE_TARGET'; targetId: string }
  | { type: 'PLAY_CARD'; instanceId: string; targetId?: string }
  | { type: 'END_TURN' }
  | { type: 'PLAY_CANCEL'; instanceId: string }
  | { type: 'PASS_CANCEL' };

export interface DiceFatePlayerView {
  gameId: 'dice-fate';
  phase: DiceFateState['phase'];
  currentTurnPlayerId: string | null;
  activeTurnPlayerId: string | null;
  myPlayerId: string;
  myHand: DiceFateCardInstance[];
  lastDieFace: DiceFateDieFace | null;
  bannedDeck: DiceFateDeckColor | null;
  playedCardThisTurn: boolean;
  pendingRedCard: {
    actorId: string;
    card: DiceFateCardInstance;
    targetId?: string;
  } | null;
  activeDare: { targetUsername: string; prompt: string } | null;
  peekedHand: { targetUsername: string; cards: DiceFateCardInstance[] } | null;
  deckCount: number;
  rules: DiceFateRules;
  legalActions: DiceFateAction[];
  players: Array<{
    id: string;
    username: string;
    avatarId: string;
    lives: number;
    shields: number;
    alive: boolean;
    cardCount: number;
  }>;
  actionLog: GameActionLogEntry[];
  isGameOver: boolean;
  result: GameResult | null;
}

function serverRandomInt(maxExclusive: number): number {
  const proc = (
    globalThis as unknown as {
      process?: {
        getBuiltinModule?: (name: string) => { randomInt?: (min: number, max: number) => number };
      };
    }
  ).process;
  const nodeCrypto = proc?.getBuiltinModule?.('crypto');
  if (nodeCrypto?.randomInt) {
    return nodeCrypto.randomInt(0, maxExclusive);
  }
  return Math.floor(Math.random() * maxExclusive);
}

function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function nextAliveTurnIndex(
  players: GamePlayer[],
  lives: Record<string, number>,
  skipNextTurn: Record<string, boolean>,
  fromIndex: number,
): { turnIndex: number; skipNextTurn: Record<string, boolean> } {
  const nextSkip = { ...skipNextTurn };
  const n = players.length;
  for (let offset = 1; offset <= n * 2; offset++) {
    const idx = (fromIndex + offset) % n;
    const pid = players[idx]!.id;
    if ((lives[pid] ?? 0) <= 0) continue;
    if (nextSkip[pid]) {
      nextSkip[pid] = false;
      continue;
    }
    return { turnIndex: idx, skipNextTurn: nextSkip };
  }
  return { turnIndex: fromIndex, skipNextTurn: nextSkip };
}

function drawCardsFromDeck(
  deck: DiceFateCardInstance[],
  discardPile: DiceFateCardInstance[],
  count: number,
): { drawn: DiceFateCardInstance[]; deck: DiceFateCardInstance[]; discardPile: DiceFateCardInstance[] } {
  const nextDeck = [...deck];
  let nextDiscard = [...discardPile];
  const drawn: DiceFateCardInstance[] = [];
  for (let i = 0; i < count; i++) {
    if (nextDeck.length === 0 && nextDiscard.length > 0) {
      nextDeck.push(...shuffle(nextDiscard));
      nextDiscard = [];
    }
    const c = nextDeck.pop();
    if (c) drawn.push(c);
  }
  return { drawn, deck: nextDeck, discardPile: nextDiscard };
}

function applyDamage(
  lives: Record<string, number>,
  shields: Record<string, number>,
  eliminationOrder: string[],
  targetId: string,
  amount: number,
): { blocked: boolean; eliminated: boolean } {
  if ((lives[targetId] ?? 0) <= 0) return { blocked: false, eliminated: false };
  if ((shields[targetId] ?? 0) > 0) {
    shields[targetId] = shields[targetId]! - 1;
    return { blocked: true, eliminated: false };
  }
  const next = Math.max(0, (lives[targetId] ?? 0) - amount);
  lives[targetId] = next;
  if (next === 0 && !eliminationOrder.includes(targetId)) {
    eliminationOrder.push(targetId);
    return { blocked: false, eliminated: true };
  }
  return { blocked: false, eliminated: false };
}

function checkWinner(state: DiceFateState): DiceFateState {
  const survivors = state.players.filter((p) => (state.lives[p.id] ?? 0) > 0);
  if (survivors.length <= 1) {
    const winnerIds = survivors.map((s) => s.id);
    const nextLog = [...state.actionLog];
    if (winnerIds.length === 1) {
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `🏆 ${survivors[0]!.username} là người sống sót cuối cùng và chiến thắng!`,
        timestamp: Date.now(),
      });
    }
    return {
      ...state,
      phase: 'finished',
      winnerIds,
      actionLog: nextLog,
    };
  }
  return state;
}

function resolveEffect(
  state: DiceFateState,
  actorId: string,
  targetId: string | undefined,
  effect: DiceFateEffect,
  rules: DiceFateRules,
): DiceFateState {
  const actor = state.players.find((p) => p.id === actorId)!;
  const target = targetId ? state.players.find((p) => p.id === targetId) : undefined;
  const nextLives = { ...state.lives };
  const nextShields = { ...state.shields };
  const nextSkip = { ...state.skipNextTurn };
  const nextElims = [...state.eliminationOrder];
  let nextDeck = [...state.deck];
  let nextDiscard = [...state.discardPile];
  const nextHands: Record<string, DiceFateCardInstance[]> = {};
  for (const [k, v] of Object.entries(state.hands)) {
    nextHands[k] = [...v];
  }
  const nextLog = [...state.actionLog];
  let bannedDeck = state.bannedDeck;
  let activeDare = state.activeDare;
  const nextPeeked = { ...state.peekedByPlayer };

  switch (effect.type) {
    case 'NOOP':
      break;
    case 'DRAW_CARD': {
      const res = drawCardsFromDeck(nextDeck, nextDiscard, effect.count);
      nextDeck = res.deck;
      nextDiscard = res.discardPile;
      nextHands[actorId]!.push(...res.drawn);
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} rút thêm ${res.drawn.length} lá bài.`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'HEAL': {
      const cur = nextLives[actorId] ?? 0;
      const healed = Math.min(rules.maxLives, cur + effect.amount);
      nextLives[actorId] = healed;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} hồi phục lên ${healed} mạng.`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'ADD_SHIELD': {
      nextShields[actorId] = (nextShields[actorId] ?? 0) + effect.amount;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `${actor.username} nhận ${effect.amount} Khiên Bảo Hộ.`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'ALL_LOSE_LIFE': {
      for (const p of state.players) {
        if ((nextLives[p.id] ?? 0) > 0) {
          applyDamage(nextLives, nextShields, nextElims, p.id, effect.amount);
        }
      }
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `🌋 Thiên tai! Tất cả người chơi mất ${effect.amount} mạng (nếu không có khiên).`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'LOSE_LIFE':
    case 'TARGET_LOSE_LIFE': {
      if (target) {
        const res = applyDamage(nextLives, nextShields, nextElims, target.id, effect.amount);
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: res.blocked
            ? `${target.username} dùng Khiên Bảo Hộ chặn đòn!`
            : `${target.username} mất ${effect.amount} mạng (còn ${nextLives[target.id]} mạng).`,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'BAN_DECK': {
      bannedDeck = effect.deck;
      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `🚫 Vòng này bị cấm đánh thẻ ${effect.deck === 'red' ? 'Đỏ' : 'Xanh'}!`,
        timestamp: Date.now(),
      });
      break;
    }
    case 'DARE_TEXT': {
      if (target) {
        activeDare = { targetUsername: target.username, prompt: effect.prompt };
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `🎭 ${target.username} nhận thử thách: "${effect.prompt}"`,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'STEAL_CARD': {
      if (target && nextHands[target.id]!.length > 0) {
        const idx = Math.floor(Math.random() * nextHands[target.id]!.length);
        const [stolen] = nextHands[target.id]!.splice(idx, 1);
        nextHands[actorId]!.push(stolen!);
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} cướp 1 lá bài từ ${target.username}.`,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'SWAP_CARD_RANDOM': {
      if (target && nextHands[target.id]!.length > 0 && nextHands[actorId]!.length > 0) {
        const aIdx = Math.floor(Math.random() * nextHands[actorId]!.length);
        const tIdx = Math.floor(Math.random() * nextHands[target.id]!.length);
        const aCard = nextHands[actorId]![aIdx]!;
        const tCard = nextHands[target.id]![tIdx]!;
        nextHands[actorId]![aIdx] = tCard;
        nextHands[target.id]![tIdx] = aCard;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} hoán đổi 1 lá bài với ${target.username}.`,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'PEEK_HAND': {
      if (target) {
        nextPeeked[actorId] = {
          targetUsername: target.username,
          cards: [...(nextHands[target.id] ?? [])],
        };
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} đã dùng Thấu Thị soi bài của ${target.username}.`,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'SKIP_NEXT': {
      if (target) {
        nextSkip[target.id] = true;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${target.username} bị khoá lượt kế tiếp!`,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'CANCEL_RED':
      break;
  }

  return checkWinner({
    ...state,
    lives: nextLives,
    shields: nextShields,
    skipNextTurn: nextSkip,
    eliminationOrder: nextElims,
    deck: nextDeck,
    discardPile: nextDiscard,
    hands: nextHands,
    bannedDeck,
    activeDare,
    peekedByPlayer: nextPeeked,
    actionLog: nextLog,
  });
}

export function createDiceFateModule(
  rules: DiceFateRules,
): GameModule<DiceFateState, DiceFateAction, DiceFatePlayerView, DiceFateOptions> {
  const cardDefMap = new Map<string, DiceFateCardDef>(rules.cards.map((c) => [c.id, c]));

  return {
    id: 'dice-fate',
    minPlayers: 3,
    maxPlayers: 8,

    setup(players, options) {
      if (players.length < 3 || players.length > 8) {
        throw new Error('Xúc Xắc Định Mệnh cần từ 3 đến 8 người chơi');
      }

      const rng = options?.rng ?? Math.random;
      let seq = 1;
      const allCards: DiceFateCardInstance[] = [];
      for (const def of rules.cards) {
        for (let i = 0; i < def.copies; i++) {
          allCards.push({ instanceId: `df_${seq++}`, defId: def.id, deck: def.deck });
        }
      }

      const deck = shuffle(allCards, rng);
      const hands: Record<string, DiceFateCardInstance[]> = {};
      const lives: Record<string, number> = {};
      const shields: Record<string, number> = {};
      const skipNextTurn: Record<string, boolean> = {};
      const peekedByPlayer: Record<string, null> = {};

      for (const p of players) {
        lives[p.id] = rules.startingLives;
        shields[p.id] = 0;
        skipNextTurn[p.id] = false;
        peekedByPlayer[p.id] = null;
        hands[p.id] = [];
        for (let i = 0; i < rules.startingHandSize; i++) {
          const c = deck.pop();
          if (c) hands[p.id]!.push(c);
        }
      }

      return {
        players: [...players],
        lives,
        shields,
        skipNextTurn,
        eliminationOrder: [],
        deck,
        discardPile: [],
        hands,
        turnIndex: 0,
        phase: 'shake_pending',
        lastDieFace: null,
        pendingDieAmount: 0,
        bannedDeck: null,
        playedCardThisTurn: false,
        pendingRedCard: null,
        activeDare: null,
        peekedByPlayer,
        winnerIds: [],
        actionLog: [
          {
            id: 'start',
            text: `Ván Xúc Xắc Định Mệnh bắt đầu với ${players.length} người chơi (${rules.startingLives} mạng mỗi người).`,
            timestamp: Date.now(),
          },
        ],
      };
    },

    getLegalActions(state, playerId) {
      if (state.phase === 'finished' || (state.lives[playerId] ?? 0) <= 0) return [];

      const myHand = state.hands[playerId] ?? [];

      if (state.phase === 'cancel_window') {
        const pending = state.pendingRedCard;
        if (!pending) return [];
        const actions: DiceFateAction[] = [];
        for (const c of myHand) {
          const def = cardDefMap.get(c.defId);
          if (def?.effect.type === 'CANCEL_RED') {
            actions.push({ type: 'PLAY_CANCEL', instanceId: c.instanceId });
          }
        }
        if (!pending.passedPlayerIds.includes(playerId)) {
          actions.push({ type: 'PASS_CANCEL' });
        }
        return actions;
      }

      const current = state.players[state.turnIndex];
      if (!current || current.id !== playerId) return [];

      if (state.phase === 'shake_pending') {
        return [{ type: 'SHAKE_DIE' }];
      }

      const otherAlive = state.players.filter(
        (p) => p.id !== playerId && (state.lives[p.id] ?? 0) > 0,
      );

      if (state.phase === 'die_target_pending') {
        return otherAlive.map((t) => ({ type: 'CHOOSE_DIE_TARGET', targetId: t.id }));
      }

      // card_phase
      const actions: DiceFateAction[] = [{ type: 'END_TURN' }];
      if (!state.playedCardThisTurn) {
        for (const card of myHand) {
          const def = cardDefMap.get(card.defId);
          if (!def) continue;
          if (def.effect.type === 'CANCEL_RED') continue;
          if (state.bannedDeck && card.deck === state.bannedDeck) continue;

          if (def.requiresTarget) {
            for (const target of otherAlive) {
              actions.push({ type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target.id });
            }
          } else {
            actions.push({ type: 'PLAY_CARD', instanceId: card.instanceId });
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
      const nextLog = [...state.actionLog];

      if (action.type === 'SHAKE_DIE') {
        const faceIdx = serverRandomInt(rules.dieFaces.length);
        const face = rules.dieFaces[faceIdx]!;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `🎲 ${actor.username} lắc ra mặt: ${face.emoji} ${face.label} — ${face.description}`,
          timestamp: Date.now(),
        });

        if (face.effect.type === 'TARGET_LOSE_LIFE') {
          return {
            ...state,
            phase: 'die_target_pending',
            lastDieFace: face,
            pendingDieAmount: face.effect.amount,
            actionLog: nextLog,
          };
        }

        const resolved = resolveEffect(
          { ...state, lastDieFace: face, actionLog: nextLog },
          playerId,
          undefined,
          face.effect,
          rules,
        );

        if (resolved.phase === 'finished') return resolved;
        return { ...resolved, phase: 'card_phase' };
      }

      if (action.type === 'CHOOSE_DIE_TARGET') {
        const resolved = resolveEffect(
          state,
          playerId,
          action.targetId,
          { type: 'TARGET_LOSE_LIFE', amount: state.pendingDieAmount },
          rules,
        );
        if (resolved.phase === 'finished') return resolved;
        return { ...resolved, phase: 'card_phase', pendingDieAmount: 0 };
      }

      if (action.type === 'END_TURN') {
        const adv = nextAliveTurnIndex(state.players, state.lives, state.skipNextTurn, state.turnIndex);
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} kết thúc lượt.`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          turnIndex: adv.turnIndex,
          skipNextTurn: adv.skipNextTurn,
          phase: 'shake_pending',
          playedCardThisTurn: false,
          bannedDeck: adv.turnIndex === 0 ? null : state.bannedDeck,
          peekedByPlayer: { ...state.peekedByPlayer, [playerId]: null },
          actionLog: nextLog,
        };
      }

      if (action.type === 'PLAY_CARD') {
        const nextHands = { ...state.hands, [playerId]: [...(state.hands[playerId] ?? [])] };
        const idx = nextHands[playerId]!.findIndex((c) => c.instanceId === action.instanceId);
        const [card] = nextHands[playerId]!.splice(idx, 1);
        const def = cardDefMap.get(card!.defId)!;
        const nextDiscard = [...state.discardPile, card!];

        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} đánh thẻ ${def.deck === 'red' ? '🔴' : '🟢'} ${def.name}.`,
          timestamp: Date.now(),
        });

        if (card!.deck === 'red') {
          return {
            ...state,
            hands: nextHands,
            discardPile: nextDiscard,
            playedCardThisTurn: true,
            phase: 'cancel_window',
            pendingRedCard: {
              actorId: playerId,
              card: card!,
              targetId: action.targetId,
              canceled: false,
              passedPlayerIds: [playerId],
            },
            actionLog: nextLog,
          };
        }

        const resolved = resolveEffect(
          {
            ...state,
            hands: nextHands,
            discardPile: nextDiscard,
            playedCardThisTurn: true,
            actionLog: nextLog,
          },
          playerId,
          action.targetId,
          def.effect,
          rules,
        );
        return resolved;
      }

      if (action.type === 'PLAY_CANCEL') {
        const nextHands = { ...state.hands, [playerId]: [...(state.hands[playerId] ?? [])] };
        const idx = nextHands[playerId]!.findIndex((c) => c.instanceId === action.instanceId);
        const [cancelCard] = nextHands[playerId]!.splice(idx, 1);
        const nextDiscard = [...state.discardPile, cancelCard!];
        const pending = state.pendingRedCard!;
        const pendingDef = cardDefMap.get(pending.card.defId)!;

        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `✨ ${actor.username} dùng Hoá Giải huỷ bỏ thẻ ${pendingDef.name}!`,
          timestamp: Date.now(),
        });

        return {
          ...state,
          hands: nextHands,
          discardPile: nextDiscard,
          phase: 'card_phase',
          pendingRedCard: null,
          actionLog: nextLog,
        };
      }

      // PASS_CANCEL
      const pending = state.pendingRedCard!;
      const passed = [...pending.passedPlayerIds, playerId];
      const aliveIds = state.players.filter((p) => (state.lives[p.id] ?? 0) > 0).map((p) => p.id);
      const allPassed = aliveIds.every((id) => passed.includes(id));

      if (!allPassed) {
        return {
          ...state,
          pendingRedCard: {
            ...pending,
            passedPlayerIds: passed,
          },
        };
      }

      const pendingDef = cardDefMap.get(pending.card.defId)!;
      const resolved = resolveEffect(
        { ...state, pendingRedCard: null },
        pending.actorId,
        pending.targetId,
        pendingDef.effect,
        rules,
      );
      if (resolved.phase === 'finished') return resolved;
      return { ...resolved, phase: 'card_phase' };
    },

    getPlayerView(state, playerId) {
      let currentTurnPlayerId: string | null = null;
      if (state.phase === 'cancel_window' && state.pendingRedCard) {
        const nextResponder = state.players.find(
          (p) =>
            (state.lives[p.id] ?? 0) > 0 && !state.pendingRedCard!.passedPlayerIds.includes(p.id),
        );
        currentTurnPlayerId = nextResponder?.id ?? null;
      } else if (state.phase !== 'finished') {
        currentTurnPlayerId = state.players[state.turnIndex]?.id ?? null;
      }

      return {
        gameId: 'dice-fate',
        phase: state.phase,
        currentTurnPlayerId,
        activeTurnPlayerId:
          state.phase !== 'finished' ? (state.players[state.turnIndex]?.id ?? null) : null,
        myPlayerId: playerId,
        myHand: [...(state.hands[playerId] ?? [])],
        lastDieFace: state.lastDieFace,
        bannedDeck: state.bannedDeck,
        playedCardThisTurn: state.playedCardThisTurn,
        pendingRedCard: state.pendingRedCard
          ? {
              actorId: state.pendingRedCard.actorId,
              card: state.pendingRedCard.card,
              targetId: state.pendingRedCard.targetId,
            }
          : null,
        activeDare: state.activeDare,
        peekedHand: state.peekedByPlayer[playerId] ?? null,
        deckCount: state.deck.length,
        rules,
        legalActions: this.getLegalActions(state, playerId),
        players: state.players.map((p) => ({
          id: p.id,
          username: p.username,
          avatarId: p.avatarId,
          lives: state.lives[p.id] ?? 0,
          shields: state.shields[p.id] ?? 0,
          alive: (state.lives[p.id] ?? 0) > 0,
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
          score: state.lives[id] ?? 0,
        })),
        summary: 'Kết thúc ván Xúc Xắc Định Mệnh',
      };
    },
  };
}

export const DiceFateGame = createDiceFateModule(defaultRules as DiceFateRules);
