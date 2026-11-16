import Redis from 'ioredis';
import {
  getGameCatalogItem,
  type GameId,
  type MatchStatusPayload,
  type PublicUser,
  type QueueJoinInput,
} from '@boardgame/shared';

export interface QueuedPlayer {
  user: PublicUser;
  gameId: GameId;
  playerCount: number;
  enqueuedAt: number;
}

export interface QueueStore {
  push(key: string, entry: QueuedPlayer): Promise<void>;
  list(key: string): Promise<QueuedPlayer[]>;
  removeUsers(key: string, userIds: string[]): Promise<void>;
}

export class InMemoryQueueStore implements QueueStore {
  private readonly buckets = new Map<string, QueuedPlayer[]>();

  async push(key: string, entry: QueuedPlayer): Promise<void> {
    const arr = this.buckets.get(key) ?? [];
    arr.push(entry);
    this.buckets.set(key, arr);
  }

  async list(key: string): Promise<QueuedPlayer[]> {
    return [...(this.buckets.get(key) ?? [])];
  }

  async removeUsers(key: string, userIds: string[]): Promise<void> {
    const arr = this.buckets.get(key);
    if (!arr) return;
    const set = new Set(userIds);
    const filtered = arr.filter((e) => !set.has(e.user.id));
    if (filtered.length === 0) {
      this.buckets.delete(key);
    } else {
      this.buckets.set(key, filtered);
    }
  }
}

export class RedisQueueStore implements QueueStore {
  constructor(private readonly redis: Redis) {}

  async push(key: string, entry: QueuedPlayer): Promise<void> {
    await this.redis.rpush(`mq:${key}`, JSON.stringify(entry));
  }

  async list(key: string): Promise<QueuedPlayer[]> {
    const raw = await this.redis.lrange(`mq:${key}`, 0, -1);
    return raw.map((item) => JSON.parse(item) as QueuedPlayer);
  }

  async removeUsers(key: string, userIds: string[]): Promise<void> {
    const set = new Set(userIds);
    const all = await this.list(key);
    const remaining = all.filter((e) => !set.has(e.user.id));
    const redisKey = `mq:${key}`;
    await this.redis.del(redisKey);
    if (remaining.length > 0) {
      await this.redis.rpush(redisKey, ...remaining.map((r) => JSON.stringify(r)));
    }
  }
}

export interface MatchmakingHooks {
  onStatus: (userId: string, status: MatchStatusPayload) => void;
  onMatched: (players: Array<PublicUser & { isBot?: boolean }>, gameId: GameId) => void;
}

export class MatchmakingService {
  private readonly store: QueueStore;
  private readonly userBucket = new Map<string, string>();
  private readonly timeoutTimers = new Map<string, NodeJS.Timeout>();
  private readonly recentOpponents = new Map<string, Set<string>>();

  constructor(
    redisUrl?: string,
    private readonly queueTimeoutMs = 20_000,
  ) {
    if (redisUrl) {
      const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
      redis.on('error', () => undefined);
      this.store = new RedisQueueStore(redis);
    } else {
      this.store = new InMemoryQueueStore();
    }
  }

  private bucketKey(gameId: GameId, playerCount: number): string {
    return `${gameId}:${playerCount}`;
  }

  private hasRecentOpponent(candidate: QueuedPlayer, group: QueuedPlayer[]): boolean {
    const recent = this.recentOpponents.get(candidate.user.id);
    if (!recent) return false;
    return group.some((g) => recent.has(g.user.id));
  }

  private recordOpponents(group: Array<PublicUser & { isBot?: boolean }>): void {
    const humans = group.filter((p) => !p.isBot);
    for (const p of humans) {
      const set = new Set<string>();
      for (const other of humans) {
        if (other.id !== p.id) set.add(other.id);
      }
      this.recentOpponents.set(p.id, set);
    }
  }

  private clearTimer(userId: string): void {
    const t = this.timeoutTimers.get(userId);
    if (t) {
      clearTimeout(t);
      this.timeoutTimers.delete(userId);
    }
  }

  async joinQueue(
    user: PublicUser,
    input: QueueJoinInput,
    hooks: MatchmakingHooks,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const game = getGameCatalogItem(input.gameId);
    if (input.playerCount < game.minPlayers || input.playerCount > game.maxPlayers) {
      return {
        ok: false,
        error: `${game.name} hỗ trợ từ ${game.minPlayers} đến ${game.maxPlayers} người chơi`,
      };
    }

    if (this.userBucket.has(user.id)) {
      await this.cancelQueue(user.id, hooks);
    }

    const key = this.bucketKey(input.gameId, input.playerCount);
    const entry: QueuedPlayer = {
      user,
      gameId: input.gameId,
      playerCount: input.playerCount,
      enqueuedAt: Date.now(),
    };

    await this.store.push(key, entry);
    this.userBucket.set(user.id, key);

    const queue = await this.store.list(key);
    if (queue.length >= input.playerCount) {
      const group = this.pickCompatibleGroup(queue, input.playerCount);
      if (group) {
        const ids = group.map((g) => g.user.id);
        await this.store.removeUsers(key, ids);
        for (const id of ids) {
          this.userBucket.delete(id);
          this.clearTimer(id);
        }
        this.recordOpponents(group.map((g) => g.user));
        hooks.onMatched(
          group.map((g) => g.user),
          input.gameId,
        );
        return { ok: true };
      }
    }

    hooks.onStatus(user.id, {
      status: 'queuing',
      gameId: input.gameId,
      playerCount: input.playerCount,
      queueSize: queue.length,
    });

    this.clearTimer(user.id);
    this.timeoutTimers.set(
      user.id,
      setTimeout(() => {
        if (this.userBucket.has(user.id)) {
          hooks.onStatus(user.id, {
            status: 'timeout',
            gameId: input.gameId,
            playerCount: input.playerCount,
          });
        }
      }, this.queueTimeoutMs),
    );

    return { ok: true };
  }

  private pickCompatibleGroup(queue: QueuedPlayer[], needed: number): QueuedPlayer[] | null {
    // Prefer a group with no back-to-back recent opponents
    const first = queue[0];
    if (!first) return null;

    const compatible: QueuedPlayer[] = [first];
    for (let i = 1; i < queue.length && compatible.length < needed; i++) {
      const candidate = queue[i]!;
      if (!this.hasRecentOpponent(candidate, compatible)) {
        compatible.push(candidate);
      }
    }

    if (compatible.length === needed) return compatible;

    // If queue has waited > 10s or no alternative exists beyond exact count, only skip back-to-back if more players are available
    if (queue.length > needed) {
      return null;
    }

    // If everyone in a small pool has waited > 5s, allow rematch
    const oldestWaitMs = Date.now() - first.enqueuedAt;
    if (oldestWaitMs > 5_000) {
      return queue.slice(0, needed);
    }

    return null;
  }

  async cancelQueue(userId: string, hooks?: MatchmakingHooks): Promise<void> {
    this.clearTimer(userId);
    const key = this.userBucket.get(userId);
    if (key) {
      await this.store.removeUsers(key, [userId]);
      this.userBucket.delete(userId);
    }
    hooks?.onStatus(userId, { status: 'idle' });
  }

  async fillWithBots(
    userId: string,
    hooks: MatchmakingHooks,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const key = this.userBucket.get(userId);
    if (!key) {
      return { ok: false, error: 'Bạn không ở trong hàng chờ' };
    }

    const [gameId, countStr] = key.split(':') as [GameId, string];
    const needed = Number(countStr);
    const queue = await this.store.list(key);
    const humans = queue.slice(0, needed);
    const ids = humans.map((h) => h.user.id);

    await this.store.removeUsers(key, ids);
    for (const id of ids) {
      this.userBucket.delete(id);
      this.clearTimer(id);
    }

    const players: Array<PublicUser & { isBot?: boolean }> = humans.map((h) => h.user);
    let botNum = 1;
    while (players.length < needed) {
      players.push({
        id: `bot_${Date.now()}_${botNum}`,
        username: `Bot_${botNum}`,
        avatarId: 'owl',
        isGuest: true,
        isBot: true,
      });
      botNum++;
    }

    hooks.onMatched(players, gameId);
    return { ok: true };
  }
}
