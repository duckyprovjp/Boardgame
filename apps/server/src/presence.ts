import type { PresenceStatus } from '@boardgame/shared';

interface UserPresenceEntry {
  sockets: Set<string>;
  inGame: boolean;
}

export class PresenceTracker {
  private readonly users = new Map<string, UserPresenceEntry>();

  /**
   * Registers a socket for a user. Returns true if the user's status changed.
   */
  addSocket(userId: string, socketId: string): boolean {
    let entry = this.users.get(userId);
    const prevStatus = this.getStatus(userId);
    if (!entry) {
      entry = { sockets: new Set(), inGame: false };
      this.users.set(userId, entry);
    }
    entry.sockets.add(socketId);
    return prevStatus !== this.getStatus(userId);
  }

  /**
   * Unregisters a socket for a user. Returns true if the user's status changed.
   */
  removeSocket(userId: string, socketId: string): boolean {
    const entry = this.users.get(userId);
    if (!entry) return false;
    const prevStatus = this.getStatus(userId);
    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) {
      this.users.delete(userId);
    }
    return prevStatus !== this.getStatus(userId);
  }

  /**
   * Marks a user as in-game or not. Returns true if the user's status changed.
   */
  setInGame(userId: string, inGame: boolean): boolean {
    const entry = this.users.get(userId);
    if (!entry) return false;
    const prevStatus = this.getStatus(userId);
    entry.inGame = inGame;
    return prevStatus !== this.getStatus(userId);
  }

  getStatus(userId: string): PresenceStatus {
    const entry = this.users.get(userId);
    if (!entry || entry.sockets.size === 0) return 'offline';
    return entry.inGame ? 'in_game' : 'online';
  }
}
