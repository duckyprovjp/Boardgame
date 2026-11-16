import { describe, expect, it } from 'vitest';
import defaultRules from '../../games/dice-fate/rules.json';
import type { GamePlayer } from '../game';
import {
  DiceFateGame,
  computeEffectiveLethalFaces,
  countTargetByDirection,
  createDiceFateModule,
  getBaseLethalFaces,
  type DiceFateRules,
  type DiceFateState,
} from './diceFate';

const P4: GamePlayer[] = [
  { id: 'p1', username: 'An', avatarId: 'fox', level: 1 },
  { id: 'p2', username: 'Binh', avatarId: 'cat', level: 1 },
  { id: 'p3', username: 'Chi', avatarId: 'owl', level: 1 },
  { id: 'p4', username: 'Dung', avatarId: 'bear', level: 1 },
];

function passAllAlive(state: DiceFateState, game = DiceFateGame): DiceFateState {
  let s = state;
  for (const p of s.players) {
    if (s.alive[p.id] && !s.windowPassedIds.includes(p.id)) {
      s = game.applyAction(s, p.id, { type: 'PASS_WINDOW' });
    }
  }
  return s;
}

describe('DiceFateGame (Xúc Xắc Định Mệnh)', () => {
  it('deals 1 face-down card from 50-card deck and hides opponents cards', () => {
    const state = DiceFateGame.setup(P4, { rng: () => 0.25 });
    const v1 = DiceFateGame.getPlayerView(state, 'p1');
    expect(v1.myCard).not.toBeNull();
    expect(v1.players.every((p) => p.revealedCard === null && p.hasCard)).toBe(true);
    expect((v1 as unknown as Record<string, unknown>).cards).toBeUndefined();

    // Reaction window UI is indistinguishable between holders and non-holders
    const v2 = DiceFateGame.getPlayerView(state, 'p2');
    expect(v1.phase).toBe(v2.phase);
    expect(v1.legalActions[0]).toEqual({ type: 'PASS_WINDOW' });
    expect(v2.legalActions[0]).toEqual({ type: 'PASS_WINDOW' });
  });

  it('matches every row of lethalFaces table including 2-player odd/even', () => {
    const rules = defaultRules as DiceFateRules;
    expect(getBaseLethalFaces(6, rules)).toEqual([1]);
    expect(getBaseLethalFaces(5, rules)).toEqual([1, 6]);
    expect(getBaseLethalFaces(4, rules)).toEqual([1, 5, 6]);
    expect(getBaseLethalFaces(3, rules)).toEqual([1, 4, 5, 6]);
    expect(getBaseLethalFaces(2, rules)).toEqual([1, 3, 5]);
  });

  it('applies A1 priority: Rule Lock / Odds Shift (last wins) + Hazard Boost on top', () => {
    const state = DiceFateGame.setup(P4, { rng: () => 0.5 });
    const s1: DiceFateState = {
      ...state,
      replaceLethalFaces: [5, 6], // Odds Shift
      addedLethalFaces: [2], // Hazard Boost
    };
    expect(computeEffectiveLethalFaces(s1, defaultRules as DiceFateRules)).toEqual([2, 5, 6]);
  });

  it('counts direction left/right starting at 1 on self', () => {
    const alive = { p1: true, p2: true, p3: true, p4: true };
    expect(countTargetByDirection(P4, alive, 'p1', 'right', 3)).toBe('p3');
    expect(countTargetByDirection(P4, alive, 'p1', 'left', 3)).toBe('p3');
    expect(countTargetByDirection(P4, alive, 'p1', 'right', 2)).toBe('p2');
    expect(countTargetByDirection(P4, alive, 'p1', 'left', 2)).toBe('p4');
  });

  it('handles Blast Shield on lethal roll and resolves as safe pass', () => {
    const base = DiceFateGame.setup(P4, { rng: () => 0.5 });
    const state: DiceFateState = {
      ...base,
      activePlayerId: 'p1',
      explodingPlayerId: 'p1',
      explosionFromLethalRoll: true,
      lastDieValue: 1,
      phase: 'ON_ELIMINATED_WINDOW',
      windowPassedIds: [],
      cards: {
        p1: { instanceId: 'c1', defId: 'blast_shield' },
        p2: null,
        p3: null,
        p4: null,
      },
    };

    const afterShield = DiceFateGame.applyAction(state, 'p1', { type: 'PLAY_CARD' });
    expect(afterShield.phase).toBe('CHOOSE_DIRECTION');
    const afterDir = DiceFateGame.applyAction(afterShield, 'p1', {
      type: 'CHOOSE_DIRECTION',
      direction: 'right',
    });
    expect(afterDir.activePlayerId).toBe('p2');
    expect(afterDir.alive.p1).toBe(true);
  });

  it('handles Chain Reaction in 2-player game (exploder loses first, opponent wins)', () => {
    const p2 = P4.slice(0, 2);
    const state: DiceFateState = {
      players: p2,
      alive: { p1: true, p2: true },
      eliminationOrder: [],
      cards: {
        p1: { instanceId: 'cr1', defId: 'chain_reaction' },
        p2: null,
      },
      activePlayerId: 'p1',
      lastPasserId: null,
      explodingPlayerId: 'p1',
      explosionFromLethalRoll: true,
      phase: 'ON_ELIMINATED_WINDOW',
      windowPassedIds: [],
      lastDieValue: 3,
      rerollUsedThisRoll: false,
      replaceLethalFaces: null,
      addedLethalFaces: [],
      winnerIds: [],
      actionLog: [],
    };

    const finished = DiceFateGame.applyAction(state, 'p1', {
      type: 'PLAY_CARD',
      targetId: 'p2',
    });
    expect(DiceFateGame.isGameOver(finished)).toBe(true);
    expect(DiceFateGame.getResult(finished).winnerIds).toEqual(['p2']);
  });

  it('handles Triple Verdict when exactly 3 alive, and Nullify destroying hidden card', () => {
    const p3 = P4.slice(0, 3);
    const state: DiceFateState = {
      players: p3,
      alive: { p1: true, p2: true, p3: true },
      eliminationOrder: [],
      cards: {
        p1: { instanceId: 'n1', defId: 'nullify' },
        p2: { instanceId: 'tv1', defId: 'triple_verdict' },
        p3: null,
      },
      activePlayerId: 'p1',
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
      actionLog: [],
    };

    // p2 plays triple_verdict on p3 -> 2 alive remain
    const afterTv = DiceFateGame.applyAction(state, 'p2', {
      type: 'PLAY_CARD',
      targetId: 'p3',
    });
    expect(afterTv.alive.p3).toBe(false);

    // p1 nullifies p2's card (if p2 still had one)
    const afterNullify = DiceFateGame.applyAction(
      { ...state, cards: { ...state.cards, p3: { instanceId: 'x', defId: 'evade' } } },
      'p1',
      { type: 'PLAY_CARD', targetId: 'p3' },
    );
    expect(afterNullify.cards.p3).toBeNull();
  });

  it('changes behavior when rules.json is edited without touching engine code', () => {
    const customRules: DiceFateRules = {
      ...(defaultRules as DiceFateRules),
      lethalFacesByAliveCount: {
        ...(defaultRules as DiceFateRules).lethalFacesByAliveCount,
        '4': [1, 2, 3, 4],
      },
    };
    const customGame = createDiceFateModule(customRules);
    const s = customGame.setup(P4, { rng: () => 0.4 });
    const v = customGame.getPlayerView(s, 'p1');
    expect(v.effectiveLethalFaces).toEqual([1, 2, 3, 4]);
    expect(passAllAlive(s, customGame).phase).toBe('BEFORE_ROLL_WINDOW');
  });
});
