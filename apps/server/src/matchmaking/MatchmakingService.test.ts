import { describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@boardgame/shared';
import { MatchmakingService } from './MatchmakingService';

const mkUser = (id: string): PublicUser => ({
  id,
  username: `user_${id}`,
  avatarId: 'fox',
  isGuest: false,
});

describe('MatchmakingService', () => {
  it('matches 4 queued players into one game and avoids immediate rematch', async () => {
    const mm = new MatchmakingService(undefined, 20_000);
    const onMatched = vi.fn();
    const onStatus = vi.fn();

    for (const id of ['u1', 'u2', 'u3', 'u4']) {
      await mm.joinQueue(mkUser(id), { gameId: 'high-card', playerCount: 4 }, { onMatched, onStatus });
    }

    expect(onMatched).toHaveBeenCalledTimes(1);
    expect(onMatched.mock.calls[0]![0]).toHaveLength(4);

    // Re-queue same 4 players immediately -> back-to-back avoidance holds if wait < 5s
    onMatched.mockClear();
    for (const id of ['u1', 'u2', 'u3', 'u4']) {
      await mm.joinQueue(mkUser(id), { gameId: 'high-card', playerCount: 4 }, { onMatched, onStatus });
    }
    expect(onMatched).not.toHaveBeenCalled();

    // Add a 5th fresh player -> matches!
    await mm.joinQueue(mkUser('u5'), { gameId: 'high-card', playerCount: 4 }, { onMatched, onStatus });
    // Still wait or cancel
    await mm.cancelQueue('u1', { onMatched, onStatus });
    expect(onStatus).toHaveBeenCalledWith('u1', { status: 'idle' });
  });

  it('supports queue timeout and fillWithBots', async () => {
    vi.useFakeTimers();
    const mm = new MatchmakingService(undefined, 5_000);
    const onMatched = vi.fn();
    const onStatus = vi.fn();

    await mm.joinQueue(mkUser('u1'), { gameId: 'color-uno', playerCount: 4 }, { onMatched, onStatus });
    vi.advanceTimersByTime(5_000);

    expect(onStatus).toHaveBeenCalledWith('u1', {
      status: 'timeout',
      gameId: 'color-uno',
      playerCount: 4,
    });

    const filled = await mm.fillWithBots('u1', { onMatched, onStatus });
    expect(filled.ok).toBe(true);
    expect(onMatched).toHaveBeenCalledTimes(1);
    expect(onMatched.mock.calls[0]![0]).toHaveLength(4);
    expect(onMatched.mock.calls[0]![0].filter((p: { isBot?: boolean }) => p.isBot)).toHaveLength(3);
    vi.useRealTimers();
  });
});
