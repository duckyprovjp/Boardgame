import { describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@boardgame/shared';
import { sanitizeChatText } from '../sanitize';
import { RoomManager } from './RoomManager';

const u1: PublicUser = { id: 'u1', username: 'host_user', avatarId: 'fox', isGuest: false };
const u2: PublicUser = { id: 'u2', username: 'player_two', avatarId: 'cat', isGuest: false };
const u3: PublicUser = { id: 'u3', username: 'player_three', avatarId: 'owl', isGuest: false };

describe('sanitizeChatText', () => {
  it('strips angle brackets and control chars', () => {
    expect(sanitizeChatText('  <b>Xin   chào</b>\n\u0007  ')).toBe('bXin chào/b');
  });
});

describe('RoomManager', () => {
  it('creates a room, joins by code, readies up, and starts', () => {
    const rm = new RoomManager(50);
    const created = rm.createRoom(u1, { gameId: 'high-card', maxPlayers: 4, visibility: 'public' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const code = created.room.code;
    expect(code).toHaveLength(6);

    const joined = rm.joinRoom(u2, code);
    expect(joined.ok).toBe(true);

    // Cannot start before u2 is ready
    const earlyStart = rm.startGame(u1.id);
    expect(earlyStart.ok).toBe(false);

    rm.setReady(u2.id, true);
    const started = rm.startGame(u1.id);
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.room.status).toBe('starting');
    }
  });

  it('supports kick, transfer host, leave, and auto-delete when empty', () => {
    const rm = new RoomManager(50);
    const created = rm.createRoom(u1, { gameId: 'high-card', maxPlayers: 4, visibility: 'private' });
    if (!created.ok) throw new Error('failed');
    const code = created.room.code;

    rm.joinRoom(u2, code);
    rm.joinRoom(u3, code);

    const kicked = rm.kickMember(u1.id, u3.id);
    expect(kicked.ok).toBe(true);
    if (kicked.ok) {
      expect(kicked.room.members.map((m) => m.id)).toEqual(['u1', 'u2']);
    }

    const transferred = rm.transferHost(u1.id, u2.id);
    expect(transferred.ok).toBe(true);
    if (transferred.ok) {
      expect(transferred.room.hostId).toBe('u2');
    }

    rm.leaveRoom(u1.id);
    const afterU2Leaves = rm.leaveRoom(u2.id);
    expect(afterU2Leaves?.room).toBeNull();
    expect(rm.getRoomByCode(code)).toBeUndefined();
  });

  it('allows reconnect within grace period and removes after timeout', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const created = rm.createRoom(u1, { gameId: 'high-card', maxPlayers: 4, visibility: 'private' });
    if (!created.ok) throw new Error('failed');
    const code = created.room.code;
    rm.joinRoom(u2, code);

    const onExpire = vi.fn();
    rm.handleDisconnect(u2.id, onExpire);
    expect(rm.getRoomByCode(code)?.members.find((m) => m.id === u2.id)?.connected).toBe(false);

    // Reconnect before 60s
    vi.advanceTimersByTime(30_000);
    const rejoined = rm.handleReconnect(u2.id);
    expect(rejoined?.members.find((m) => m.id === u2.id)?.connected).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();

    // Disconnect and let expire
    rm.handleDisconnect(u2.id, onExpire);
    vi.advanceTimersByTime(60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(rm.getRoomByCode(code)?.members.map((m) => m.id)).toEqual(['u1']);
    vi.useRealTimers();
  });
});
