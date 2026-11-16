import { describe, expect, it } from 'vitest';
import { PresenceTracker } from './presence';

describe('PresenceTracker', () => {
  it('tracks multi-tab connections and transitions online/offline accurately', () => {
    const tracker = new PresenceTracker();
    expect(tracker.getStatus('u1')).toBe('offline');

    expect(tracker.addSocket('u1', 's1')).toBe(true);
    expect(tracker.getStatus('u1')).toBe('online');

    // Second tab does not change status
    expect(tracker.addSocket('u1', 's2')).toBe(false);
    expect(tracker.getStatus('u1')).toBe('online');

    // Closing first tab keeps user online
    expect(tracker.removeSocket('u1', 's1')).toBe(false);
    expect(tracker.getStatus('u1')).toBe('online');

    // Closing last tab transitions to offline
    expect(tracker.removeSocket('u1', 's2')).toBe(true);
    expect(tracker.getStatus('u1')).toBe('offline');
  });

  it('tracks in_game state when online', () => {
    const tracker = new PresenceTracker();
    tracker.addSocket('u1', 's1');
    expect(tracker.setInGame('u1', true)).toBe(true);
    expect(tracker.getStatus('u1')).toBe('in_game');

    expect(tracker.setInGame('u1', false)).toBe(true);
    expect(tracker.getStatus('u1')).toBe('online');
  });
});
