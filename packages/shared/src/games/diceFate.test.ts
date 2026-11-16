import { describe, expect, it } from 'vitest';
import defaultRules from '../../games/dice-fate/rules.json';
import type { GamePlayer } from '../game';
import {
  DiceFateGame,
  createDiceFateModule,
  type DiceFateRules,
  type DiceFateState,
} from './diceFate';

const P3: GamePlayer[] = [
  { id: 'p1', username: 'An', avatarId: 'fox' },
  { id: 'p2', username: 'Binh', avatarId: 'cat' },
  { id: 'p3', username: 'Chi', avatarId: 'owl' },
];

describe('DiceFateGame', () => {
  it('initializes with 3 lives and 4 cards and filters hidden hands', () => {
    const state = DiceFateGame.setup(P3, { rng: () => 0.4 });
    const view = DiceFateGame.getPlayerView(state, 'p1');

    expect(view.myHand).toHaveLength(4);
    expect(view.players.every((p) => p.lives === 3 && p.cardCount === 4)).toBe(true);
    expect((view as unknown as Record<string, unknown>).deck).toBeUndefined();
    expect((view as unknown as Record<string, unknown>).hands).toBeUndefined();
  });

  it('shakes die on server, resolves card effects, and handles green cancel window', () => {
    const state: DiceFateState = {
      players: P3,
      lives: { p1: 3, p2: 3, p3: 3 },
      shields: { p1: 0, p2: 0, p3: 0 },
      skipNextTurn: { p1: false, p2: false, p3: false },
      eliminationOrder: [],
      deck: [{ instanceId: 'd1', defId: 'green_heal', deck: 'green' }],
      discardPile: [],
      hands: {
        p1: [{ instanceId: 'c1', defId: 'red_strike', deck: 'red' }],
        p2: [{ instanceId: 'c2', defId: 'green_cancel', deck: 'green' }],
        p3: [],
      },
      turnIndex: 0,
      phase: 'shake_pending',
      lastDieFace: null,
      pendingDieAmount: 0,
      bannedDeck: null,
      playedCardThisTurn: false,
      pendingRedCard: null,
      activeDare: null,
      peekedByPlayer: { p1: null, p2: null, p3: null },
      winnerIds: [],
      actionLog: [],
    };

    // Shake die
    let next = DiceFateGame.applyAction(state, 'p1', { type: 'SHAKE_DIE' });
    if (next.phase === 'die_target_pending') {
      next = DiceFateGame.applyAction(next, 'p1', { type: 'CHOOSE_DIE_TARGET', targetId: 'p3' });
    }
    expect(next.phase).toBe('card_phase');

    // If die rolled ban_red, clear ban to test red card + cancel window deterministically
    if (next.bannedDeck === 'red') {
      next = { ...next, bannedDeck: null };
    }

    // p1 plays red_strike on p2 -> enters cancel_window
    next = DiceFateGame.applyAction(next, 'p1', {
      type: 'PLAY_CARD',
      instanceId: 'c1',
      targetId: 'p2',
    });
    expect(next.phase).toBe('cancel_window');

    // p2 cancels with green_cancel -> p2 keeps lives!
    const livesBeforeCancel = next.lives.p2;
    next = DiceFateGame.applyAction(next, 'p2', { type: 'PLAY_CANCEL', instanceId: 'c2' });
    expect(next.phase).toBe('card_phase');
    expect(next.lives.p2).toBe(livesBeforeCancel);
  });

  it('eliminates player at 0 lives and declares last survivor winner', () => {
    const state: DiceFateState = {
      players: P3.slice(0, 2).concat([{ id: 'p3', username: 'Chi', avatarId: 'owl' }]),
      lives: { p1: 3, p2: 1, p3: 0 },
      shields: { p1: 0, p2: 0, p3: 0 },
      skipNextTurn: { p1: false, p2: false, p3: false },
      eliminationOrder: ['p3'],
      deck: [],
      discardPile: [],
      hands: {
        p1: [{ instanceId: 'c1', defId: 'red_curse', deck: 'red' }],
        p2: [],
        p3: [],
      },
      turnIndex: 0,
      phase: 'card_phase',
      lastDieFace: null,
      pendingDieAmount: 0,
      bannedDeck: null,
      playedCardThisTurn: false,
      pendingRedCard: null,
      activeDare: null,
      peekedByPlayer: { p1: null, p2: null, p3: null },
      winnerIds: [],
      actionLog: [],
    };

    let next = DiceFateGame.applyAction(state, 'p1', {
      type: 'PLAY_CARD',
      instanceId: 'c1',
      targetId: 'p2',
    });
    next = DiceFateGame.applyAction(next, 'p2', { type: 'PASS_CANCEL' });

    expect(DiceFateGame.isGameOver(next)).toBe(true);
    expect(DiceFateGame.getResult(next).winnerIds).toEqual(['p1']);
  });

  it('supports changing rules.json without touching engine code', () => {
    const customRules: DiceFateRules = {
      ...(defaultRules as DiceFateRules),
      startingLives: 5,
      startingHandSize: 2,
    };
    const customGame = createDiceFateModule(customRules);
    const state = customGame.setup(P3);
    expect(state.lives.p1).toBe(5);
    expect(state.hands.p1).toHaveLength(2);
  });
});
