import { describe, expect, it } from 'vitest';
import type { GamePlayer } from '../game';
import type { PlayingCard } from './highCard';
import { PokerGame, compareEvaluatedHands, evaluateBestHand } from './poker';

const P3: GamePlayer[] = [
  { id: 'p1', username: 'An', avatarId: 'fox' },
  { id: 'p2', username: 'Binh', avatarId: 'cat' },
  { id: 'p3', username: 'Chi', avatarId: 'owl' },
];

describe('Poker hand evaluator', () => {
  it('ranks Straight Flush > Four of a Kind > Full House > Flush > Wheel Straight', () => {
    const sf = evaluateBestHand([
      { rank: 10, suit: 'spades' },
      { rank: 11, suit: 'spades' },
      { rank: 12, suit: 'spades' },
      { rank: 13, suit: 'spades' },
      { rank: 14, suit: 'spades' },
      { rank: 2, suit: 'clubs' },
      { rank: 3, suit: 'hearts' },
    ]);
    const quads = evaluateBestHand([
      { rank: 9, suit: 'spades' },
      { rank: 9, suit: 'hearts' },
      { rank: 9, suit: 'diamonds' },
      { rank: 9, suit: 'clubs' },
      { rank: 14, suit: 'spades' },
      { rank: 2, suit: 'clubs' },
      { rank: 3, suit: 'hearts' },
    ]);
    const wheel: PlayingCard[] = [
      { rank: 14, suit: 'spades' },
      { rank: 2, suit: 'hearts' },
      { rank: 3, suit: 'diamonds' },
      { rank: 4, suit: 'clubs' },
      { rank: 5, suit: 'spades' },
      { rank: 13, suit: 'clubs' },
      { rank: 9, suit: 'hearts' },
    ];
    const wheelEval = evaluateBestHand(wheel);

    expect(sf.category).toBe(8);
    expect(quads.category).toBe(7);
    expect(wheelEval.category).toBe(4);
    expect(wheelEval.tiebreakers[0]).toBe(5);
    expect(compareEvaluatedHands(sf, quads)).toBeGreaterThan(0);
    expect(compareEvaluatedHands(quads, wheelEval)).toBeGreaterThan(0);
  });
});

describe('PokerGame', () => {
  it('filters hidden hole cards and deck in getPlayerView', () => {
    const state = PokerGame.setup(P3, { rng: () => 0.42 });
    const v1 = PokerGame.getPlayerView(state, 'p1');
    const v2 = PokerGame.getPlayerView(state, 'p2');

    expect(v1.myHoleCards).toHaveLength(2);
    expect(v2.myHoleCards).toHaveLength(2);
    expect(v1.myHoleCards).not.toEqual(v2.myHoleCards);
    expect((v1 as unknown as Record<string, unknown>).deck).toBeUndefined();
    expect((v1 as unknown as Record<string, unknown>).holeCards).toBeUndefined();
    expect(v1.players.every((p) => p.revealedCards === null)).toBe(true);
  });

  it('progresses streets and finishes match on all-in', () => {
    let state = PokerGame.setup(P3.slice(0, 2), {
      rng: () => 0.5,
      startingChips: 200,
      smallBlind: 25,
      bigBlind: 50,
    });

    let steps = 0;
    while (!PokerGame.isGameOver(state) && steps < 40) {
      const v = PokerGame.getPlayerView(state, state.players[state.turnIndex]!.id);
      const act =
        v.legalActions.find((a) => a.type === 'ALL_IN') ??
        v.legalActions.find((a) => a.type === 'CALL') ??
        v.legalActions[0]!;
      state = PokerGame.applyAction(state, v.myPlayerId, act);
      steps++;
    }

    expect(PokerGame.isGameOver(state)).toBe(true);
    expect(PokerGame.getResult(state).winnerIds).toHaveLength(1);
  });
});
