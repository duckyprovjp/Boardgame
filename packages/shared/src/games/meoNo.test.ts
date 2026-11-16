import { describe, expect, it } from 'vitest';
import type { GamePlayer } from '../game';
import { MeoNoGame, type MeoNoState } from './meoNo';

const P3: GamePlayer[] = [
  { id: 'p1', username: 'An', avatarId: 'fox' },
  { id: 'p2', username: 'Binh', avatarId: 'cat' },
  { id: 'p3', username: 'Chi', avatarId: 'owl' },
];

describe('MeoNoGame', () => {
  it('handles Nope chain (odd cancels, even allows)', () => {
    const state: MeoNoState = {
      players: P3,
      alive: { p1: true, p2: true, p3: true },
      eliminationOrder: [],
      deck: [{ id: 'd1', kind: 'skip' }],
      discardPile: [],
      hands: {
        p1: [{ id: 's1', kind: 'skip' }, { id: 'n1', kind: 'nope' }],
        p2: [{ id: 'n2', kind: 'nope' }],
        p3: [],
      },
      turnIndex: 0,
      turnsRemaining: 1,
      phase: 'playing',
      pendingAction: null,
      pendingBombCard: null,
      defusingPlayerId: null,
      favorRequesterId: null,
      favorTargetId: null,
      peekedByPlayer: { p1: null, p2: null, p3: null },
      winnerIds: [],
      actionLog: [],
    };

    // p1 plays skip -> enters nope_window
    let next = MeoNoGame.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 's1' });
    expect(next.phase).toBe('nope_window');

    // p2 plays nope (count = 1)
    next = MeoNoGame.applyAction(next, 'p2', { type: 'PLAY_NOPE', cardId: 'n2' });
    expect(next.pendingAction?.nopeCount).toBe(1);

    // p1 plays nope back (count = 2 -> even -> skip resolves!)
    next = MeoNoGame.applyAction(next, 'p1', { type: 'PLAY_NOPE', cardId: 'n1' });
    next = MeoNoGame.applyAction(next, 'p2', { type: 'PASS_NOPE' });
    next = MeoNoGame.applyAction(next, 'p3', { type: 'PASS_NOPE' });

    expect(next.phase).toBe('playing');
    expect(next.players[next.turnIndex]?.id).toBe('p2');
  });

  it('supports attack stacking and defuse re-insertion at chosen position', () => {
    const state: MeoNoState = {
      players: P3,
      alive: { p1: true, p2: true, p3: true },
      eliminationOrder: [],
      deck: [
        { id: 'safe1', kind: 'combo_potato' },
        { id: 'safe2', kind: 'combo_rainbow' },
        { id: 'bomb1', kind: 'bomb' },
      ],
      discardPile: [],
      hands: {
        p1: [{ id: 'a1', kind: 'attack' }],
        p2: [{ id: 'a2', kind: 'attack' }],
        p3: [{ id: 'def1', kind: 'defuse' }],
      },
      turnIndex: 0,
      turnsRemaining: 1,
      phase: 'playing',
      pendingAction: null,
      pendingBombCard: null,
      defusingPlayerId: null,
      favorRequesterId: null,
      favorTargetId: null,
      peekedByPlayer: { p1: null, p2: null, p3: null },
      winnerIds: [],
      actionLog: [],
    };

    // p1 attacks -> p2 gets 2 turns
    let next = MeoNoGame.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'a1' });
    next = MeoNoGame.applyAction(next, 'p2', { type: 'PASS_NOPE' });
    next = MeoNoGame.applyAction(next, 'p3', { type: 'PASS_NOPE' });
    expect(next.players[next.turnIndex]?.id).toBe('p2');
    expect(next.turnsRemaining).toBe(2);

    // p2 stacks attack -> p3 gets 4 turns!
    next = MeoNoGame.applyAction(next, 'p2', { type: 'PLAY_CARD', cardId: 'a2' });
    next = MeoNoGame.applyAction(next, 'p1', { type: 'PASS_NOPE' });
    next = MeoNoGame.applyAction(next, 'p3', { type: 'PASS_NOPE' });
    expect(next.players[next.turnIndex]?.id).toBe('p3');
    expect(next.turnsRemaining).toBe(4);

    // p3 draws bomb -> defuse_pending
    next = MeoNoGame.applyAction(next, 'p3', { type: 'DRAW_CARD' });
    expect(next.phase).toBe('defuse_pending');

    // p3 inserts bomb at position 0 (top of deck) -> turnsRemaining decrements to 3
    next = MeoNoGame.applyAction(next, 'p3', { type: 'DEFUSE_INSERT', position: 0 });
    expect(next.phase).toBe('playing');
    expect(next.turnsRemaining).toBe(3);
    expect(next.deck[next.deck.length - 1]?.kind).toBe('bomb');
  });

  it('keeps see_future top 3 private to the viewer only', () => {
    const state: MeoNoState = {
      players: P3,
      alive: { p1: true, p2: true, p3: true },
      eliminationOrder: [],
      deck: [
        { id: 'c1', kind: 'skip' },
        { id: 'c2', kind: 'bomb' },
        { id: 'c3', kind: 'attack' },
      ],
      discardPile: [],
      hands: {
        p1: [{ id: 'sf1', kind: 'see_future' }],
        p2: [],
        p3: [],
      },
      turnIndex: 0,
      turnsRemaining: 1,
      phase: 'playing',
      pendingAction: null,
      pendingBombCard: null,
      defusingPlayerId: null,
      favorRequesterId: null,
      favorTargetId: null,
      peekedByPlayer: { p1: null, p2: null, p3: null },
      winnerIds: [],
      actionLog: [],
    };

    let next = MeoNoGame.applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'sf1' });
    next = MeoNoGame.applyAction(next, 'p2', { type: 'PASS_NOPE' });
    next = MeoNoGame.applyAction(next, 'p3', { type: 'PASS_NOPE' });

    const p1View = MeoNoGame.getPlayerView(next, 'p1');
    const p2View = MeoNoGame.getPlayerView(next, 'p2');
    expect(p1View.peekedTop3?.map((c) => c.kind)).toEqual(['attack', 'bomb', 'skip']);
    expect(p2View.peekedTop3).toBeNull();
  });

  it('eliminates player without defuse and declares last survivor winner', () => {
    const state: MeoNoState = {
      players: P3.slice(0, 2),
      alive: { p1: true, p2: true },
      eliminationOrder: [],
      deck: [{ id: 'bomb1', kind: 'bomb' }],
      discardPile: [],
      hands: { p1: [], p2: [] },
      turnIndex: 0,
      turnsRemaining: 1,
      phase: 'playing',
      pendingAction: null,
      pendingBombCard: null,
      defusingPlayerId: null,
      favorRequesterId: null,
      favorTargetId: null,
      peekedByPlayer: { p1: null, p2: null },
      winnerIds: [],
      actionLog: [],
    };

    const finished = MeoNoGame.applyAction(state, 'p1', { type: 'DRAW_CARD' });
    expect(MeoNoGame.isGameOver(finished)).toBe(true);
    expect(MeoNoGame.getResult(finished).winnerIds).toEqual(['p2']);
  });
});
