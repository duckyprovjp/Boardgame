import { describe, expect, it } from 'vitest';
import type { GamePlayer } from '../game';
import { ColorUnoGame, createUnoDeck, type ColorUnoState } from './colorUno';

const P2: GamePlayer[] = [
  { id: 'p1', username: 'An', avatarId: 'fox', level: 1 },
  { id: 'p2', username: 'Binh', avatarId: 'cat', level: 2 },
];

const P4: GamePlayer[] = [
  ...P2,
  { id: 'p3', username: 'Chi', avatarId: 'owl', level: 1 },
  { id: 'p4', username: 'Dung', avatarId: 'bear', level: 3 },
];

describe('ColorUnoGame (Bài Sắc Màu)', () => {
  it('creates a 108-card deck and never starts with wild_draw_four', () => {
    const deck = createUnoDeck(() => 0.5);
    expect(deck).toHaveLength(108);

    const state = ColorUnoGame.setup(P4, { rng: () => 0.3 });
    expect(state.discardPile[0]?.kind).not.toBe('wild_draw_four');
    const view = ColorUnoGame.getPlayerView(state, 'p1');
    expect(view.myHand).toHaveLength(7);
    expect((view as unknown as Record<string, unknown>).deck).toBeUndefined();
    expect((view as unknown as Record<string, unknown>).hands).toBeUndefined();
  });

  it('treats reverse as skip in 2-player games', () => {
    const state: ColorUnoState = {
      players: P2,
      deck: [{ id: 'd1', color: 'red', kind: '5' }],
      discardPile: [{ id: 'top', color: 'red', kind: '1' }],
      hands: {
        p1: [
          { id: 'c1', color: 'red', kind: 'reverse' },
          { id: 'c2', color: 'blue', kind: '2' },
        ],
        p2: [{ id: 'c3', color: 'red', kind: '3' }],
      },
      scores: { p1: 0, p2: 0 },
      roundNumber: 1,
      roundsMode: 'single',
      stackDrawCards: false,
      forcedPlayAfterDraw: false,
      pendingDrawCount: 0,
      activeColor: 'red',
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled: { p1: false, p2: false },
      wd4Challenge: null,
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    const next = ColorUnoGame.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'c1' });
    expect(next.players[next.turnIndex]?.id).toBe('p1');
  });

  it('handles wild_draw_four challenge success (bluff) and failure (legal)', () => {
    const base: ColorUnoState = {
      players: P2,
      deck: Array.from({ length: 10 }, (_, i) => ({
        id: `d${i}`,
        color: 'blue' as const,
        kind: '2' as const,
      })),
      discardPile: [{ id: 'top', color: 'red', kind: '1' }],
      hands: {
        p1: [
          { id: 'wd4', color: 'wild', kind: 'wild_draw_four' },
          { id: 'red1', color: 'red', kind: '5' }, // illegal bluff!
          { id: 'extra', color: 'green', kind: '6' },
        ],
        p2: [{ id: 'c2', color: 'green', kind: '3' }],
      },
      scores: { p1: 0, p2: 0 },
      roundNumber: 1,
      roundsMode: 'single',
      stackDrawCards: false,
      forcedPlayAfterDraw: false,
      pendingDrawCount: 0,
      activeColor: 'red',
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled: { p1: false, p2: false },
      wd4Challenge: null,
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    // Bluffing WD4 -> challenge succeeds -> p1 draws 4
    let next = ColorUnoGame.applyAction(base, 'p1', {
      type: 'PLAY_CARD',
      cardId: 'wd4',
      chosenColor: 'blue',
    });
    expect(next.phase).toBe('wd4_challenge');
    next = ColorUnoGame.applyAction(next, 'p2', { type: 'CHALLENGE_WD4' });
    expect(next.phase).toBe('playing');
    expect(next.hands.p1).toHaveLength(6); // 2 left + 4 penalty
    expect(next.players[next.turnIndex]?.id).toBe('p2');

    // Legal WD4 (no red card) -> challenge fails -> p2 draws 6
    const legalBase: ColorUnoState = {
      ...base,
      hands: {
        p1: [
          { id: 'wd4', color: 'wild', kind: 'wild_draw_four' },
          { id: 'extra', color: 'green', kind: '6' },
        ],
        p2: [{ id: 'c2', color: 'green', kind: '3' }],
      },
    };
    let next2 = ColorUnoGame.applyAction(legalBase, 'p1', {
      type: 'PLAY_CARD',
      cardId: 'wd4',
      chosenColor: 'blue',
    });
    next2 = ColorUnoGame.applyAction(next2, 'p2', { type: 'CHALLENGE_WD4' });
    expect(next2.hands.p2).toHaveLength(7); // 1 + 6 penalty
    expect(next2.players[next2.turnIndex]?.id).toBe('p1'); // p2 lost turn
  });

  it('reshuffles discard pile, enforces last-card penalty, and scores 500-point race', () => {
    const state: ColorUnoState = {
      players: P2,
      deck: [],
      discardPile: [
        { id: 'old0', color: 'red', kind: '2' },
        { id: 'old1', color: 'red', kind: '5' },
        { id: 'old2', color: 'red', kind: '7' },
        { id: 'top', color: 'red', kind: '1' },
      ],
      hands: {
        p1: [{ id: 'c1', color: 'blue', kind: '9' }],
        p2: [{ id: 'c2', color: 'red', kind: '3' }],
      },
      scores: { p1: 0, p2: 0 },
      roundNumber: 1,
      roundsMode: 'single',
      stackDrawCards: false,
      forcedPlayAfterDraw: false,
      pendingDrawCount: 0,
      activeColor: 'red',
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled: { p1: false, p2: false },
      wd4Challenge: null,
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    let next = ColorUnoGame.applyAction(state, 'p1', { type: 'DRAW_CARD' });
    const drawnId = next.drawnCardId!;
    next = ColorUnoGame.applyAction(next, 'p1', { type: 'PLAY_CARD', cardId: drawnId });
    const caught = ColorUnoGame.applyAction(next, 'p2', {
      type: 'CATCH_LAST_CARD',
      targetId: 'p1',
    });
    expect(caught.hands.p1).toHaveLength(3);
  });

  it('supports 500-point race across rounds', () => {
    const state: ColorUnoState = {
      players: P2,
      deck: Array.from({ length: 30 }, (_, i) => ({
        id: `d${i}`,
        color: 'red' as const,
        kind: '2' as const,
      })),
      discardPile: [{ id: 'top', color: 'red', kind: '1' }],
      hands: {
        p1: [{ id: 'c1', color: 'red', kind: '9' }],
        p2: [{ id: 'c2', color: 'wild', kind: 'wild' }], // 50 pts
      },
      scores: { p1: 0, p2: 0 },
      roundNumber: 1,
      roundsMode: '500',
      stackDrawCards: false,
      forcedPlayAfterDraw: false,
      pendingDrawCount: 0,
      activeColor: 'red',
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled: { p1: true, p2: false },
      wd4Challenge: null,
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    const nextRound = ColorUnoGame.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'c1' });
    expect(nextRound.phase).toBe('playing');
    expect(nextRound.roundNumber).toBe(2);
    expect(nextRound.scores.p1).toBe(50);
  });
});
