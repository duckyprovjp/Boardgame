'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GAME_CATALOG,
  getAvatarById,
  type GameId,
  type LeaderboardEntry,
} from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';
import { progressionApi } from '@/lib/api';

export default function LeaderboardPage() {
  const { user, loadingAuth } = useApp();
  const featured = GAME_CATALOG.filter((g) => g.featured);
  const [gameId, setGameId] = useState<GameId>('color-uno');
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await progressionApi.leaderboard(gameId, scope);
      setEntries(res.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [gameId, scope]);

  useEffect(() => {
    if (user) void loadLeaderboard();
  }, [user, loadLeaderboard]);

  if (loadingAuth || !user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 text-center text-sm text-slate-400">
        Đang tải bảng xếp hạng...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Bảng xếp hạng</h1>
          <p className="text-xs text-slate-400">Xếp hạng theo điểm kỹ năng từng trò chơi</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value as GameId)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
          >
            {featured.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <div className="flex rounded-xl bg-slate-900 p-1 text-xs">
            <button
              type="button"
              onClick={() => setScope('global')}
              className={`cursor-pointer rounded-lg px-3 py-1.5 font-semibold ${
                scope === 'global' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              Toàn cầu
            </button>
            <button
              type="button"
              onClick={() => setScope('friends')}
              className={`cursor-pointer rounded-lg px-3 py-1.5 font-semibold ${
                scope === 'friends' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              Bạn bè
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        {loading ? (
          <p className="py-8 text-center text-xs text-slate-400">Đang tải...</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">Chưa có dữ liệu xếp hạng.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e, idx) => {
              const av = getAvatarById(e.avatarId);
              return (
                <div
                  key={e.userId}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 font-mono font-bold text-amber-400">#{idx + 1}</span>
                    <span className="text-xl">{av.emoji}</span>
                    <span className="font-semibold text-white">{e.username}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">
                      {e.wins} thắng · {e.losses} thua
                    </span>
                    <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-mono font-bold text-emerald-300">
                      {e.elo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
