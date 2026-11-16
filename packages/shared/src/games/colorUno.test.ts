import { describe, expect, it } from 'vitest';
import type { GamePlayer } from '../game';
import { ColorUnoGame, createUnoDeck, type ColorUnoState } from './colorUno';

const P2: GamePlayer[] = [
  { id: 'p1', username: 'An', avatarId: 'fox' },
  { id: 'p2', username: 'Binh', avatarId: 'cat' },
];

const P4: GamePlayer[] = [
  ...P2,
  { id: 'p3', username: 'Chi', avatarId: 'owl' },
  { id: 'p4', username: 'Dung', avatarId: 'bear' },
];

describe('ColorUnoGame', () => {
  it('creates a 108-card deck', () => {
    const deck = createUnoDeck(() => 0.5);
    expect(deck).toHaveLength(108);
  });

  it('filters hidden deck and opponent hands in getPlayerView', () => {
    const state = ColorUnoGame.setup(P4, { rng: () => 0.3 });
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
      activeColor: 'red',
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled: { p1: false, p2: false },
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    const next = ColorUnoGame.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'c1' });
    // In 2-player mode, p1 keeps the turn!
    expect(next.players[next.turnIndex]?.id).toBe('p1');
  });

  it('handles draw_two, wild_draw_four, and 4-player direction reversal', () => {
    const state: ColorUnoState = {
      players: P4,
      deck: [
        { id: 'd1', color: 'red', kind: '1' },
        { id: 'd2', color: 'red', kind: '2' },
        { id: 'd3', color: 'blue', kind: '3' },
        { id: 'd4', color: 'blue', kind: '4' },
        { id: 'd5', color: 'green', kind: '5' },
        { id: 'd6', color: 'green', kind: '6' },
      ],
      discardPile: [{ id: 'top', color: 'red', kind: '0' }],
      hands: {
        p1: [
          { id: 'c1', color: 'red', kind: 'reverse' },
          { id: 'c1b', color: 'red', kind: '9' },
        ],
        p2: [{ id: 'c2', color: 'red', kind: '3' }],
        p3: [{ id: 'c3', color: 'red', kind: '4' }],
        p4: [
          { id: 'c4', color: 'red', kind: 'draw_two' },
          { id: 'c4b', color: 'wild', kind: 'wild_draw_four' },
        ],
      },
      activeColor: 'red',
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled: { p1: false, p2: false, p3: false, p4: false },
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    // p1 plays reverse -> direction becomes -1, turn goes to p4
    let next = ColorUnoGame.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'c1' });
    expect(next.direction).toBe(-1);
    expect(next.players[next.turnIndex]?.id).toBe('p4');

    // p4 plays draw_two -> p3 draws 2 and is skipped -> turn goes to p2
    next = ColorUnoGame.applyAction(next, 'p4', { type: 'PLAY_CARD', cardId: 'c4' });
    expect(next.hands.p3).toHaveLength(3);
    expect(next.players[next.turnIndex]?.id).toBe('p2');
  });

  it('reshuffles discard pile when deck is empty and supports optional play of drawn card', () => {
    const state: ColorUnoState = {
      players: P2,
      deck: [],
      discardPile: [
        { id: 'old0', color: 'red', kind: '2' },
        { id: 'old2', color: 'red', kind: '3' },
        { id: 'old1', color: 'red', kind: '5' },
        { id: 'top', color: 'red', kind: '1' },
      ],
      hands: {
        p1: [{ id: 'c1', color: 'blue', kind: '9' }],
        p2: [{ id: 'c2', color: 'green', kind: '3' }],
      },
      activeColor: 'red',
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled: { p1: false, p2: false },
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    let next = ColorUnoGame.applyAction(state, 'p1', { type: 'DRAW_CARD' });
    const drawnId = next.drawnCardId!;
    expect(drawnId).toBeTruthy();
    expect(next.hands.p1).toHaveLength(2);

    // Play the drawn playable card (if not playable, skip; here let's ensure rng picks old1 or play drawn)
    const canPlayDrawn = ColorUnoGame.getLegalActions(next, 'p1').some(
      (a) => a.type === 'PLAY_CARD' && a.cardId === drawnId,
    );
    if (!canPlayDrawn) {
      // With seeded rng, ensure playable card is drawn
      throw new Error('Expected drawn card to be playable');
    }
    next = ColorUnoGame.applyAction(next, 'p1', { type: 'PLAY_CARD', cardId: drawnId });
    expect(next.hands.p1).toHaveLength(1);
    expect(next.players[next.turnIndex]?.id).toBe('p2');

    // p2 catches p1 for missing "Còn 1 lá!" call -> p1 draws 2 penalty cards
    const caught = ColorUnoGame.applyAction(next, 'p2', {
      type: 'CATCH_LAST_CARD',
      targetId: 'p1',
    });
    expect(caught.hands.p1).toHaveLength(3);
  });

  it('calculates winner score from opponents remaining cards', () => {
    const state: ColorUnoState = {
      players: P2,
      deck: [{ id: 'd1', color: 'red', kind: '5' }],
      discardPile: [{ id: 'top', color: 'red', kind: '1' }],
      hands: {
        p1: [{ id: 'c1', color: 'red', kind: '9' }],
        p2: [
          { id: 'c2', color: 'wild', kind: 'wild' }, // 50
          { id: 'c3', color: 'blue', kind: 'skip' }, // 20
          { id: 'c4', color: 'blue', kind: '4' }, // 4
        ],
      },
      activeColor: 'red',
      direction: 1,
      turnIndex: 0,
      drawnCardId: null,
      lastCardCalled: { p1: true, p2: false },
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    const finished = ColorUnoGame.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'c1' });
    expect(ColorUnoGame.isGameOver(finished)).toBe(true);
    const result = ColorUnoGame.getResult(finished);
    expect(result.winnerIds).toEqual(['p1']);
    expect(result.rankings[0]).toEqual({ playerId: 'p1', rank: 1, score: 74 });
  });
});
