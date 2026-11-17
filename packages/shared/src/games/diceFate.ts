import defaultRules from '../../games/dice-fate/rules.json';
import type { GameActionLogEntry, GameModule, GamePlayer, GameResult } from '../game';

export type DiceFateCardColor = 'green' | 'red';
export type DiceFateDirection = 'left' | 'right';

export type DiceFateTiming =
  | 'ANY_REACTION'
  | 'BEFORE_ROLL_OWN'
  | 'BEFORE_ROLL_OTHER'
  | 'AFTER_ROLL_OTHER'
  | 'ON_ELIMINATED_OWN'
  | 'ON_RECEIVE_DIE'
  | 'START_OF_TURN_THREE_ALIVE';

export type DiceFateEffectOp =
  | { op: 'DESTROY_CARD' }
  | { op: 'SET_LETHAL_FACES'; faces: number[] }
  | { op: 'ADD_LETHAL_FACE'; preferredFace: number }
  | { op: 'CANCEL_OWN_EXPLOSION' }
  | { op: 'SKIP_ROLL_PASS_TO' }
  | { op: 'SWAP_CARDS' }
  | { op: 'EXPLODE_PASSER' }
  | { op: 'REROLL_TARGET' }
  | { op: 'EXPLODE_TARGET' }
  | { op: 'CHAIN_ELIMINATE' }
  | { op: 'FORCE_TARGET_ROLL' };

export interface DiceFateCardDef {
  id: string;
  name: string;
  color: DiceFateCardColor;
  count: number;
  timing: DiceFateTiming;
  requiresTarget: 'none' | 'other_alive' | 'other_alive_with_card' | 'adjacent_alive' | 'any_alive';
  description: string;
  effectOps: DiceFateEffectOp[];
}

export interface DiceFateRules {
  deckSize: number;
  timers: {
    turnSec: number;
    reactionWindowMs: number;
  };
  lethalFacesByAliveCount: {
    gte6: number[];
    '5': number[];
    '4': number[];
    '3': number[];
    '2': number[];
  };
  assumptions: {
    secretSwapTrueExchange: boolean;
    forcedRerollOncePerRoll: boolean;
    nullifyAnyReactionWindow: boolean;
  };
  cards: DiceFateCardDef[];
}

export interface DiceFateCardInstance {
  instanceId: string;
  defId: string;
}

export type DiceFatePhase =
  | 'START_OF_TURN_WINDOW'
  | 'BEFORE_ROLL_WINDOW'
  | 'ROLL_DIE'
  | 'AFTER_ROLL_WINDOW'
  | 'CHOOSE_DIRECTION'
  | 'ON_ELIMINATED_WINDOW'
  | 'CHOOSE_NEXT_HOLDER'
  | 'ON_RECEIVE_DIE_WINDOW'
  | 'FINISHED';

export interface DiceFateOptions {
  rng?: () => number;
}

export interface DiceFateState {
  players: GamePlayer[];
  alive: Record<string, boolean>;
  eliminationOrder: string[];
  cards: Record<string, DiceFateCardInstance | null>;
  deckCount: number;
  discardPile: DiceFateCardInstance[];
  activePlayerId: string;
  lastPasserId: string | null;
  explodingPlayerId: string | null;
  explosionFromLethalRoll: boolean;
  phase: DiceFatePhase;
  windowPassedIds: string[];
  lastDieValue: number | null;
  rerollUsedThisRoll: boolean;
  replaceLethalFaces: number[] | null;
  addedLethalFaces: number[];
  winnerIds: string[];
  actionLog: GameActionLogEntry[];
}

export type DiceFateAction =
  | { type: 'PASS_WINDOW' }
  | { type: 'ROLL_DIE' }
  | { type: 'CHOOSE_DIRECTION'; direction: DiceFateDirection }
  | { type: 'CHOOSE_NEXT_HOLDER'; targetId: string }
  | { type: 'PLAY_CARD'; targetId?: string };

export interface DiceFatePlayerView {
  gameId: 'dice-fate';
  phase: DiceFatePhase;
  activePlayerId: string;
  currentTurnPlayerId: string | null;
  explodingPlayerId: string | null;
  myPlayerId: string;
  myCard: DiceFateCardInstance | null;
  deckCount: number;
  recentDiscard: DiceFateCardInstance[];
  lastDieValue: number | null;
  effectiveLethalFaces: number[];
  windowPassedIds: string[];
  rules: DiceFateRules;
  legalActions: DiceFateAction[];
  players: Array<{
    id: string;
    username: string;
    avatarId: string;
    level: number;
    alive: boolean;
    hasCard: boolean;
    revealedCard: DiceFateCardInstance | null;
  }>;
  actionLog: GameActionLogEntry[];
  isGameOver: boolean;
  result: GameResult | null;
}

function serverRandomInt(minInclusive: number, maxExclusive: number): number {
  const proc = (
    globalThis as unknown as {
      process?: {
        getBuiltinModule?: (name: string) => { randomInt?: (min: number, max: number) => number };
      };
    }
  ).process;
  const nodeCrypto = proc?.getBuiltinModule?.('crypto');
  if (nodeCrypto?.randomInt) {
    return nodeCrypto.randomInt(minInclusive, maxExclusive);
  }
  return minInclusive + Math.floor(Math.random() * (maxExclusive - minInclusive));
}

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Computes base lethal faces from rules.json.
 * Rationale: face 1 always lands on self; faces > aliveCount overrun the table;
 * with 2 players, odd faces = BÙM and even faces = pass to the opponent.
 */
export function getBaseLethalFaces(aliveCount: number, rules: DiceFateRules): number[] {
  if (aliveCount >= 6) return [...rules.lethalFacesByAliveCount.gte6];
  if (aliveCount === 5) return [...rules.lethalFacesByAliveCount['5']];
  if (aliveCount === 4) return [...rules.lethalFacesByAliveCount['4']];
  if (aliveCount === 3) return [...rules.lethalFacesByAliveCount['3']];
  return [...rules.lethalFacesByAliveCount['2']];
}

/**
 * A1 priority: base table first -> REPLACE effects (last wins) -> ADD effects on top.
 */
export function computeEffectiveLethalFaces(state: DiceFateState, rules: DiceFateRules): number[] {
  const aliveCount = state.players.filter((p) => state.alive[p.id]).length;
  const base = state.replaceLethalFaces
    ? [...state.replaceLethalFaces]
    : getBaseLethalFaces(aliveCount, rules);
  const set = new Set(base);
  for (const f of state.addedLethalFaces) {
    set.add(f);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function getAdjacentAliveNeighbors(
  players: GamePlayer[],
  alive: Record<string, boolean>,
  centerId: string,
): { leftId: string; rightId: string } {
  const n = players.length;
  const centerIdx = players.findIndex((p) => p.id === centerId);
  let rightId = centerId;
  let leftId = centerId;

  for (let off = 1; off < n; off++) {
    const p = players[(centerIdx + off) % n]!;
    if (alive[p.id]) {
      rightId = p.id;
      break;
    }
  }
  for (let off = 1; off < n; off++) {
    const p = players[((centerIdx - off) % n + n) % n]!;
    if (alive[p.id]) {
      leftId = p.id;
      break;
    }
  }
  return { leftId, rightId };
}

/**
 * Counts alive players in direction starting with 1 at roller (self), stopping at dieValue.
 * If dieValue === 1 (e.g. Blast Shield on roll 1), passes to adjacent player in direction.
 */
export function countTargetByDirection(
  players: GamePlayer[],
  alive: Record<string, boolean>,
  rollerId: string,
  direction: DiceFateDirection,
  dieValue: number,
): string {
  const step = direction === 'right' ? 1 : -1;
  const n = players.length;
  const startIdx = players.findIndex((p) => p.id === rollerId);
  const targetCount = dieValue === 1 ? 2 : dieValue;

  let count = 1;
  let idx = startIdx;
  while (count < targetCount) {
    idx = (((idx + step) % n) + n) % n;
    if (alive[players[idx]!.id]) {
      count++;
    }
  }
  return players[idx]!.id;
}

function isReactionPhase(phase: DiceFatePhase): boolean {
  return (
    phase === 'START_OF_TURN_WINDOW' ||
    phase === 'BEFORE_ROLL_WINDOW' ||
    phase === 'AFTER_ROLL_WINDOW' ||
    phase === 'ON_ELIMINATED_WINDOW' ||
    phase === 'ON_RECEIVE_DIE_WINDOW'
  );
}

function checkWinnerOrEliminate(state: DiceFateState): DiceFateState {
  const survivors = state.players.filter((p) => state.alive[p.id]);
  if (survivors.length === 1) {
    const winner = survivors[0]!;
    const nextLog = [
      ...state.actionLog,
      {
        id: `${Date.now()}-${state.actionLog.length}`,
        text: `🏆 ${winner.username} là người sống sót cuối cùng và chiến thắng!`,
        timestamp: Date.now(),
      },
    ];
    return {
      ...state,
      phase: 'FINISHED',
      winnerIds: [winner.id],
      actionLog: nextLog,
    };
  }
  return state;
}

function eliminatePlayer(state: DiceFateState, targetId: string): DiceFateState {
  if (!state.alive[targetId]) return state;
  const nextAlive = { ...state.alive, [targetId]: false };
  const nextElims = state.eliminationOrder.includes(targetId)
    ? [...state.eliminationOrder]
    : [...state.eliminationOrder, targetId];
  const target = state.players.find((p) => p.id === targetId)!;
  const nextLog = [
    ...state.actionLog,
    {
      id: `${Date.now()}-${state.actionLog.length}`,
      text: `💥 BÙM! ${target.username} đã bị loại khỏi bàn!`,
      timestamp: Date.now(),
    },
  ];
  return checkWinnerOrEliminate({
    ...state,
    alive: nextAlive,
    eliminationOrder: nextElims,
    actionLog: nextLog,
  });
}

function startNewTurn(state: DiceFateState, holderId: string): DiceFateState {
  return {
    ...state,
    activePlayerId: holderId,
    explodingPlayerId: null,
    explosionFromLethalRoll: false,
    phase: 'START_OF_TURN_WINDOW',
    windowPassedIds: [],
    lastDieValue: null,
    rerollUsedThisRoll: false,
    replaceLethalFaces: null,
    addedLethalFaces: [],
  };
}

function advanceAfterWindow(state: DiceFateState, rules: DiceFateRules): DiceFateState {
  switch (state.phase) {
    case 'START_OF_TURN_WINDOW':
      return { ...state, phase: 'BEFORE_ROLL_WINDOW', windowPassedIds: [] };
    case 'BEFORE_ROLL_WINDOW':
      return { ...state, phase: 'ROLL_DIE', windowPassedIds: [] };
    case 'AFTER_ROLL_WINDOW': {
      const lethal = computeEffectiveLethalFaces(state, rules);
      const isLethal = state.lastDieValue !== null && lethal.includes(state.lastDieValue);
      if (isLethal) {
        return {
          ...state,
          phase: 'ON_ELIMINATED_WINDOW',
          explodingPlayerId: state.activePlayerId,
          explosionFromLethalRoll: true,
          windowPassedIds: [],
        };
      }
      return { ...state, phase: 'CHOOSE_DIRECTION', windowPassedIds: [] };
    }
    case 'ON_ELIMINATED_WINDOW': {
      const victimId = state.explodingPlayerId ?? state.activePlayerId;
      const afterElim = eliminatePlayer(state, victimId);
      if (afterElim.phase === 'FINISHED') return afterElim;
      if (victimId === state.activePlayerId) {
        return { ...afterElim, phase: 'CHOOSE_NEXT_HOLDER', windowPassedIds: [] };
      }
      return startNewTurn(afterElim, state.activePlayerId);
    }
    case 'ON_RECEIVE_DIE_WINDOW':
      return startNewTurn(state, state.activePlayerId);
    default:
      return state;
  }
}

function matchesTiming(
  def: DiceFateCardDef,
  state: DiceFateState,
  playerId: string,
): boolean {
  const aliveCount = state.players.filter((p) => state.alive[p.id]).length;
  switch (def.timing) {
    case 'ANY_REACTION':
      return isReactionPhase(state.phase);
    case 'BEFORE_ROLL_OWN':
      return state.phase === 'BEFORE_ROLL_WINDOW' && state.activePlayerId === playerId;
    case 'BEFORE_ROLL_OTHER':
      return state.phase === 'BEFORE_ROLL_WINDOW' && state.activePlayerId !== playerId;
    case 'AFTER_ROLL_OTHER':
      return (
        state.phase === 'AFTER_ROLL_WINDOW' &&
        state.activePlayerId !== playerId &&
        !state.rerollUsedThisRoll
      );
    case 'ON_ELIMINATED_OWN':
      if (state.phase !== 'ON_ELIMINATED_WINDOW' || state.explodingPlayerId !== playerId) {
        return false;
      }
      if (def.id === 'blast_shield') {
        return state.explosionFromLethalRoll;
      }
      return true;
    case 'ON_RECEIVE_DIE':
      return state.phase === 'ON_RECEIVE_DIE_WINDOW' && state.activePlayerId === playerId;
    case 'START_OF_TURN_THREE_ALIVE':
      return state.phase === 'START_OF_TURN_WINDOW' && aliveCount === 3;
  }
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
      const deck: DiceFateCardInstance[] = [];
      for (const def of rules.cards) {
        for (let i = 0; i < def.count; i++) {
          deck.push({ instanceId: `df_${seq++}`, defId: def.id });
        }
      }

      const shuffled = shuffle(deck, rng);
      const alive: Record<string, boolean> = {};
      const cards: Record<string, DiceFateCardInstance | null> = {};

      for (const p of players) {
        alive[p.id] = true;
        cards[p.id] = shuffled.pop() ?? null;
      }

      const firstIdx = options?.rng
        ? Math.floor(options.rng() * players.length)
        : serverRandomInt(0, players.length);
      const firstHolder = players[firstIdx]!;

      return {
        players: [...players],
        alive,
        eliminationOrder: [],
        cards,
        deckCount: shuffled.length,
        discardPile: [],
        activePlayerId: firstHolder.id,
        lastPasserId: null,
        explodingPlayerId: null,
        explosionFromLethalRoll: false,
        phase: 'START_OF_TURN_WINDOW',
        windowPassedIds: [],
        lastDieValue: null,
        rerollUsedThisRoll: false,
        replaceLethalFaces: null,
        addedLethalFaces: [],
        winnerIds: [],
        actionLog: [
          {
            id: 'start',
            text: `Ván Xúc Xắc Định Mệnh bắt đầu (${players.length} người chơi). ${firstHolder.username} cầm xúc xắc đầu tiên!`,
            timestamp: Date.now(),
          },
        ],
      };
    },

    getLegalActions(state, playerId) {
      if (state.phase === 'FINISHED') return [];

      // Eliminated player still performs CHOOSE_NEXT_HOLDER if they just exploded
      if (state.phase === 'CHOOSE_NEXT_HOLDER') {
        if (state.explodingPlayerId !== playerId) return [];
        const { leftId, rightId } = getAdjacentAliveNeighbors(
          state.players,
          state.alive,
          playerId,
        );
        const targets = leftId === rightId ? [leftId] : [leftId, rightId];
        return targets.map((targetId) => ({ type: 'CHOOSE_NEXT_HOLDER', targetId }));
      }

      if (!state.alive[playerId]) return [];

      if (state.phase === 'ROLL_DIE') {
        return state.activePlayerId === playerId ? [{ type: 'ROLL_DIE' }] : [];
      }

      if (state.phase === 'CHOOSE_DIRECTION') {
        if (state.activePlayerId !== playerId) return [];
        return [
          { type: 'CHOOSE_DIRECTION', direction: 'right' },
          { type: 'CHOOSE_DIRECTION', direction: 'left' },
        ];
      }

      // Reaction window phases
      if (!isReactionPhase(state.phase)) return [];

      const actions: DiceFateAction[] = [];
      if (!state.windowPassedIds.includes(playerId)) {
        actions.push({ type: 'PASS_WINDOW' });
      }

      const myCard = state.cards[playerId];
      if (myCard) {
        const def = cardDefMap.get(myCard.defId);
        if (def && matchesTiming(def, state, playerId)) {
          if (def.requiresTarget === 'none') {
            actions.push({ type: 'PLAY_CARD' });
          } else if (def.requiresTarget === 'adjacent_alive') {
            const { leftId, rightId } = getAdjacentAliveNeighbors(
              state.players,
              state.alive,
              playerId,
            );
            const adj = leftId === rightId ? [leftId] : [leftId, rightId];
            for (const t of adj) {
              if (t !== playerId) actions.push({ type: 'PLAY_CARD', targetId: t });
            }
          } else if (def.requiresTarget === 'other_alive') {
            for (const p of state.players) {
              if (p.id !== playerId && state.alive[p.id]) {
                actions.push({ type: 'PLAY_CARD', targetId: p.id });
              }
            }
          } else if (def.requiresTarget === 'other_alive_with_card') {
            for (const p of state.players) {
              if (p.id !== playerId && state.alive[p.id] && state.cards[p.id]) {
                actions.push({ type: 'PLAY_CARD', targetId: p.id });
              }
            }
          } else if (def.requiresTarget === 'any_alive') {
            for (const p of state.players) {
              if (state.alive[p.id]) {
                actions.push({ type: 'PLAY_CARD', targetId: p.id });
              }
            }
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

      if (action.type === 'PASS_WINDOW') {
        const passed = [...state.windowPassedIds, playerId];
        const aliveIds = state.players.filter((p) => state.alive[p.id]).map((p) => p.id);
        const updated = { ...state, windowPassedIds: passed };
        if (aliveIds.every((id) => passed.includes(id))) {
          return advanceAfterWindow(updated, rules);
        }
        return updated;
      }

      if (action.type === 'ROLL_DIE') {
        const dieValue = serverRandomInt(1, 7);
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `🎲 ${actor.username} tung xúc xắc ra mặt ${dieValue}!`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          lastDieValue: dieValue,
          phase: 'AFTER_ROLL_WINDOW',
          windowPassedIds: [],
          actionLog: nextLog,
        };
      }

      if (action.type === 'CHOOSE_DIRECTION') {
        const targetId = countTargetByDirection(
          state.players,
          state.alive,
          state.activePlayerId,
          action.direction,
          state.lastDieValue ?? 2,
        );
        const target = state.players.find((p) => p.id === targetId)!;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} chọn hướng ${action.direction === 'right' ? 'Phải' : 'Trái'}, chuyền xúc xắc cho ${target.username}.`,
          timestamp: Date.now(),
        });
        return {
          ...state,
          lastPasserId: playerId,
          activePlayerId: targetId,
          phase: 'ON_RECEIVE_DIE_WINDOW',
          windowPassedIds: [],
          actionLog: nextLog,
        };
      }

      if (action.type === 'CHOOSE_NEXT_HOLDER') {
        const target = state.players.find((p) => p.id === action.targetId)!;
        nextLog.push({
          id: `${Date.now()}-${nextLog.length}`,
          text: `${actor.username} trao lại xúc xắc cho ${target.username}.`,
          timestamp: Date.now(),
        });
        return startNewTurn({ ...state, lastPasserId: null, actionLog: nextLog }, action.targetId);
      }

      // PLAY_CARD (data-driven effectOp resolver)
      const playedCard = state.cards[playerId]!;
      const def = cardDefMap.get(playedCard.defId)!;
      const nextCards = { ...state.cards, [playerId]: null };
      const target = action.targetId
        ? state.players.find((p) => p.id === action.targetId)
        : undefined;

      nextLog.push({
        id: `${Date.now()}-${nextLog.length}`,
        text: `🃏 ${actor.username} kích hoạt [${def.name}]${target ? ` nhắm vào ${target.username}` : ''}!`,
        timestamp: Date.now(),
      });

      let nextState: DiceFateState = {
        ...state,
        cards: nextCards,
        discardPile: [...(state.discardPile ?? []), playedCard],
        actionLog: nextLog,
      };

      for (const op of def.effectOps) {
        switch (op.op) {
          case 'DESTROY_CARD': {
            const destroyed = action.targetId ? nextState.cards[action.targetId] : null;
            if (action.targetId && destroyed) {
              nextState = {
                ...nextState,
                cards: { ...nextState.cards, [action.targetId]: null },
                discardPile: [...nextState.discardPile, destroyed],
              };
            }
            break;
          }
          case 'SET_LETHAL_FACES': {
            nextState = { ...nextState, replaceLethalFaces: [...op.faces] };
            break;
          }
          case 'ADD_LETHAL_FACE': {
            const currentLethal = computeEffectiveLethalFaces(nextState, rules);
            let faceToAdd = op.preferredFace;
            if (currentLethal.includes(faceToAdd)) {
              const lowestSafe = [1, 2, 3, 4, 5, 6].find((f) => !currentLethal.includes(f));
              if (lowestSafe !== undefined) faceToAdd = lowestSafe;
            }
            nextState = {
              ...nextState,
              addedLethalFaces: [...nextState.addedLethalFaces, faceToAdd],
            };
            break;
          }
          case 'CANCEL_OWN_EXPLOSION': {
            nextState = {
              ...nextState,
              phase: 'CHOOSE_DIRECTION',
              explodingPlayerId: null,
              explosionFromLethalRoll: false,
              windowPassedIds: [],
            };
            break;
          }
          case 'SKIP_ROLL_PASS_TO':
          case 'FORCE_TARGET_ROLL': {
            if (action.targetId) {
              nextState = {
                ...nextState,
                lastPasserId: playerId,
                activePlayerId: action.targetId,
                phase: 'ON_RECEIVE_DIE_WINDOW',
                windowPassedIds: [],
              };
            }
            break;
          }
          case 'SWAP_CARDS': {
            if (action.targetId) {
              const targetCard = state.cards[action.targetId] ?? null;
              nextState = {
                ...nextState,
                cards: {
                  ...nextState.cards,
                  [playerId]: targetCard,
                  [action.targetId]: rules.assumptions.secretSwapTrueExchange ? playedCard : null,
                },
              };
            }
            break;
          }
          case 'EXPLODE_PASSER': {
            if (state.lastPasserId && state.alive[state.lastPasserId]) {
              nextState = {
                ...nextState,
                phase: 'ON_ELIMINATED_WINDOW',
                explodingPlayerId: state.lastPasserId,
                explosionFromLethalRoll: false,
                windowPassedIds: [],
              };
            }
            break;
          }
          case 'REROLL_TARGET': {
            const newRoll = serverRandomInt(1, 7);
            nextState = {
              ...nextState,
              lastDieValue: newRoll,
              rerollUsedThisRoll: true,
              windowPassedIds: [],
              actionLog: [
                ...nextState.actionLog,
                {
                  id: `${Date.now()}-${nextState.actionLog.length}`,
                  text: `🎲 Kết quả tung lại bắt buộc: ${newRoll}!`,
                  timestamp: Date.now(),
                },
              ],
            };
            // Second result is final -> resolve immediately!
            nextState = advanceAfterWindow(nextState, rules);
            break;
          }
          case 'EXPLODE_TARGET': {
            if (action.targetId) {
              const afterElim = eliminatePlayer(nextState, action.targetId);
              if (afterElim.phase === 'FINISHED') {
                nextState = afterElim;
              } else if (action.targetId === state.activePlayerId) {
                nextState = {
                  ...afterElim,
                  explodingPlayerId: action.targetId,
                  phase: 'CHOOSE_NEXT_HOLDER',
                  windowPassedIds: [],
                };
              } else {
                nextState = afterElim;
              }
            }
            break;
          }
          case 'CHAIN_ELIMINATE': {
            const firstElim = eliminatePlayer(nextState, playerId);
            if (firstElim.phase === 'FINISHED') {
              nextState = firstElim;
            } else if (action.targetId) {
              const secondElim = eliminatePlayer(firstElim, action.targetId);
              if (secondElim.phase === 'FINISHED') {
                nextState = secondElim;
              } else {
                nextState = {
                  ...secondElim,
                  explodingPlayerId: playerId,
                  phase: 'CHOOSE_NEXT_HOLDER',
                  windowPassedIds: [],
                };
              }
            }
            break;
          }
        }
      }

      return nextState;
    },

    getPlayerView(state, playerId) {
      let currentTurnPlayerId: string | null = null;
      if (state.phase === 'CHOOSE_NEXT_HOLDER') {
        currentTurnPlayerId = state.explodingPlayerId;
      } else if (state.phase === 'ROLL_DIE' || state.phase === 'CHOOSE_DIRECTION') {
        currentTurnPlayerId = state.activePlayerId;
      } else if (isReactionPhase(state.phase)) {
        const nextResponder = state.players.find(
          (p) => state.alive[p.id] && !state.windowPassedIds.includes(p.id),
        );
        currentTurnPlayerId = nextResponder?.id ?? state.activePlayerId;
      }

      return {
        gameId: 'dice-fate',
        phase: state.phase,
        activePlayerId: state.activePlayerId,
        currentTurnPlayerId,
        explodingPlayerId: state.explodingPlayerId,
        myPlayerId: playerId,
        myCard: state.cards[playerId] ?? null,
        deckCount: state.deckCount ?? 0,
        recentDiscard: (state.discardPile ?? []).slice(-4),
        lastDieValue: state.lastDieValue,
        effectiveLethalFaces: computeEffectiveLethalFaces(state, rules),
        windowPassedIds: [...state.windowPassedIds],
        rules,
        legalActions: this.getLegalActions(state, playerId),
        players: state.players.map((p) => ({
          id: p.id,
          username: p.username,
          avatarId: p.avatarId,
          level: p.level ?? 1,
          alive: Boolean(state.alive[p.id]),
          hasCard: state.cards[p.id] !== null && state.cards[p.id] !== undefined,
          revealedCard: state.phase === 'FINISHED' ? (state.cards[p.id] ?? null) : null,
        })),
        actionLog: state.actionLog,
        isGameOver: this.isGameOver(state),
        result: this.isGameOver(state) ? this.getResult(state) : null,
      };
    },

    isGameOver(state) {
      return state.phase === 'FINISHED';
    },

    getResult(state) {
      const reversedElims = [...state.eliminationOrder].reverse();
      const ordered = [...state.winnerIds, ...reversedElims];
      return {
        winnerIds: [...state.winnerIds],
        rankings: ordered.map((id, idx) => ({
          playerId: id,
          rank: idx + 1,
        })),
        summary: 'Kết thúc ván Xúc Xắc Định Mệnh',
      };
    },
  };
}

export const DiceFateGame = createDiceFateModule(defaultRules as DiceFateRules);
