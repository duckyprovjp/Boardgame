import { describe, expect, it } from 'vitest';
import { calculateMultiplayerElo } from './elo';

describe('calculateMultiplayerElo', () => {
  it('increases winner ELO and decreases loser ELO', () => {
    const next = calculateMultiplayerElo(
      [
        { playerId: 'p1', rank: 1 },
        { playerId: 'p2', rank: 2 },
        { playerId: 'p3', rank: 3 },
      ],
      { p1: 1000, p2: 1000, p3: 1000 },
    );

    expect(next.p1).toBeGreaterThan(1000);
    expect(next.p2).toBe(1000);
    expect(next.p3).toBeLessThan(1000);
  });
});
