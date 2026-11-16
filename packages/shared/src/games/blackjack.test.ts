import { describe, expect, it } from 'vitest';
import type { GamePlayer } from '../game';
import { BlackjackGame, calculateBlackjackScore, type BlackjackState } from './blackjack';

const P3: GamePlayer[] = [
  { id: 'p1', username: 'An', avatarId: 'fox' },
  { id: 'p2', username: 'Binh', avatarId: 'cat' },
  { id: 'p3', username: 'Chi', avatarId: 'owl' },
];

describe('BlackjackGame', () => {
  it('optimizes Ace values as 11 or 1', () => {
    expect(
      calculateBlackjackScore([
        { rank: 14, suit: 'spades' },
        { rank: 13, suit: 'hearts' },
      ]),
    ).toBe(21);
    expect(
      calculateBlackjackScore([
        { rank: 14, suit: 'spades' },
        { rank: 9, suit: 'hearts' },
        { rank: 5, suit: 'clubs' },
      ]),
    ).toBe(15);
  });

  it('filters hidden opponent hands until game is finished', () => {
    const state = BlackjackGame.setup(P3, { rng: () => 0.35 });
    const v1 = BlackjackGame.getPlayerView(state, 'p1');
    expect(v1.myHand).toHaveLength(2);
    expect((v1 as unknown as Record<string, unknown>).deck).toBeUndefined();
    const opp = v1.players.find((p) => p.id === 'p2')!;
    if (!v1.isGameOver) {
      expect(opp.revealedHand).toBeNull();
      expect(opp.revealedScore).toBeNull();
    }
  });

  it('handles bust, stand, and declares highest non-busted winner', () => {
    const state: BlackjackState = {
      players: P3.slice(0, 2),
      deck: [{ rank: 10, suit: 'spades' }],
      hands: {
        p1: [
          { rank: 10, suit: 'hearts' },
          { rank: 8, suit: 'clubs' },
        ],
        p2: [
          { rank: 10, suit: 'diamonds' },
          { rank: 9, suit: 'spades' },
        ],
      },
      statuses: { p1: 'playing', p2: 'playing' },
      turnIndex: 0,
      phase: 'playing',
      winnerIds: [],
      actionLog: [],
    };

    // p1 hits 10 -> 28 (busted)
    let next = BlackjackGame.applyAction(state, 'p1', { type: 'HIT' });
    expect(next.statuses.p1).toBe('busted');
    expect(next.players[next.turnIndex]?.id).toBe('p2');

    // p2 stands with 19 -> p2 wins
    next = BlackjackGame.applyAction(next, 'p2', { type: 'STAND' });
    expect(BlackjackGame.isGameOver(next)).toBe(true);
    expect(BlackjackGame.getResult(next).winnerIds).toEqual(['p2']);
  });
});
