import { describe, expect, it, vi } from 'vitest';
import { HighCardGame, type RoomState } from '@boardgame/shared';
import { GameManager } from './GameManager';

function makeRoom(): RoomState {
  return {
    code: 'TEST01',
    gameId: 'high-card',
    maxPlayers: 4,
    visibility: 'private',
    status: 'in_game',
    hostId: 'p1',
    members: [
      { id: 'p1', username: 'An', avatarId: 'fox', isGuest: false, isReady: true, isHost: true, connected: true },
      { id: 'p2', username: 'Binh', avatarId: 'cat', isGuest: false, isReady: true, isHost: false, connected: true },
    ],
    chat: [],
  };
}

describe('GameManager', () => {
  it('broadcasts per-player filtered views and rejects illegal actions', () => {
    const gm = new GameManager(30_000);
    const views = new Map<string, unknown>();
    const onGameOver = vi.fn();

    gm.startGame(makeRoom(), HighCardGame, {
      onPlayerView: (playerId, view) => views.set(playerId, view),
      onGameOver,
    });

    const p1View = views.get('p1') as { myHand: unknown };
    const p2View = views.get('p2') as { myHand: unknown };
    expect(p1View.myHand).not.toEqual(p2View.myHand);

    // Out-of-turn player rejected
    const bad = gm.applyAction('TEST01', 'p2', { type: 'PLAY_CARD' });
    expect(bad.ok).toBe(false);

    // Valid turns complete game
    expect(gm.applyAction('TEST01', 'p1', { type: 'PLAY_CARD' }).ok).toBe(true);
    expect(gm.applyAction('TEST01', 'p2', { type: 'PLAY_CARD' }).ok).toBe(true);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it('auto-plays on turn timer expiration', () => {
    vi.useFakeTimers();
    const gm = new GameManager(5_000);
    const onGameOver = vi.fn();

    gm.startGame(makeRoom(), HighCardGame, {
      onPlayerView: () => undefined,
      onGameOver,
    });

    vi.advanceTimersByTime(5_000);
    vi.advanceTimersByTime(5_000);

    expect(onGameOver).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
