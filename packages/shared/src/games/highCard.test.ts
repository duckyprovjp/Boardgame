import { describe, expect, it } from 'vitest';
import type { GamePlayer } from '../game';
import { HighCardGame } from './highCard';

const PLAYERS: GamePlayer[] = [
  { id: 'p1', username: 'An', avatarId: 'fox' },
  { id: 'p2', username: 'Binh', avatarId: 'cat' },
  { id: 'p3', username: 'Chi', avatarId: 'owl' },
];

describe('HighCardGame', () => {
  it('filters hidden hands and deck in getPlayerView', () => {
    const state = HighCardGame.setup(PLAYERS, { rng: () => 0.42 });
    const viewP1 = HighCardGame.getPlayerView(state, 'p1');
    const viewP2 = HighCardGame.getPlayerView(state, 'p2');

    expect(viewP1.myHand).not.toBeNull();
    expect(viewP2.myHand).not.toBeNull();
    expect(viewP1.myHand).not.toEqual(viewP2.myHand);

    // Ensure deck and other players' hands are never exposed
    expect((viewP1 as unknown as Record<string, unknown>).deck).toBeUndefined();
    expect((viewP1 as unknown as Record<string, unknown>).hands).toBeUndefined();
    expect(viewP1.players.every((p) => p.playedCard === null && p.cardCount === 1)).toBe(true);
  });

  it('allows swapping once and completes a full 3-player game', () => {
    let state = HighCardGame.setup(PLAYERS, { rng: () => 0.5 });

    // P1 swaps once
    expect(HighCardGame.getLegalActions(state, 'p1').map((a) => a.type)).toEqual([
      'PLAY_CARD',
      'SWAP_CARD',
    ]);
    state = HighCardGame.applyAction(state, 'p1', { type: 'SWAP_CARD' });
    expect(HighCardGame.getLegalActions(state, 'p1').map((a) => a.type)).toEqual(['PLAY_CARD']);

    // Out-of-turn action throws
    expect(() => HighCardGame.applyAction(state, 'p2', { type: 'PLAY_CARD' })).toThrow();

    state = HighCardGame.applyAction(state, 'p1', { type: 'PLAY_CARD' });
    state = HighCardGame.applyAction(state, 'p2', { type: 'PLAY_CARD' });
    state = HighCardGame.applyAction(state, 'p3', { type: 'PLAY_CARD' });

    expect(HighCardGame.isGameOver(state)).toBe(true);
    const result = HighCardGame.getResult(state);
    expect(result.winnerIds).toHaveLength(1);
    expect(result.rankings).toHaveLength(3);
  });
});
