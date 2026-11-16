'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GAME_CATALOG,
  getAvatarById,
  getGameCatalogItem,
  type GameId,
  type LeaderboardEntry,
  type MatchHistoryEntry,
  type UserGameStats,
} from '@boardgame/shared';
import { progressionApi } from '@/lib/api';

export function ProgressionPanel() {
  const [stats, setStats] = useState<UserGameStats[]>([]);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [lbGame, setLbGame] = useState<GameId>('color-uno');
  const [lbScope, setLbScope] = useState<'global' | 'friends'>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [meRes, lbRes] = await Promise.all([
        progressionApi.me(),
        progressionApi.leaderboard(lbGame, lbScope),
      ]);
      setStats(meRes.stats);
      setHistory(meRes.history);
      setEntries(lbRes.entries);
    } catch {
      // ignore initial error
    }
  }, [lbGame, lbScope]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Thành tích & Bảng xếp hạng</h2>
        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Làm mới
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Stats & History */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Chỉ số ELO & Thắng/Thua
            </h3>
            {stats.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có trận đấu nào được ghi nhận.</p>
            ) : (
              <div className="space-y-2">
                {stats.map((s) => (
                  <div
                    key={s.gameId}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {getGameCatalogItem(s.gameId).name}
                      </p>
                      <p className="text-slate-400">
                        Thắng: {s.wins} · Thua: {s.losses}
                      </p>
                    </div>
                    <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-mono font-bold text-emerald-300">
                      ELO {s.elo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Lịch sử đấu gần đây
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có lịch sử trận đấu.</p>
            ) : (
              <div className="max-h-44 space-y-1.5 overflow-y-auto text-xs">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                  >
                    <span className="text-slate-200">
                      {getGameCatalogItem(h.gameId as GameId).name} ({h.roomCode})
                    </span>
                    <span
                      className={`font-semibold ${h.won ? 'text-emerald-400' : 'text-slate-400'}`}
                    >
                      {h.won ? '🏆 Thắng' : `Hạng #${h.rank}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={lbGame}
              onChange={(e) => setLbGame(e.target.value as GameId)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
            >
              {GAME_CATALOG.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg bg-slate-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLbScope('global')}
                className={`rounded-md px-2.5 py-1 ${
                  lbScope === 'global' ? 'bg-emerald-500 font-semibold text-slate-950' : 'text-slate-300'
                }`}
              >
                Toàn cầu
              </button>
              <button
                type="button"
                onClick={() => setLbScope('friends')}
                className={`rounded-md px-2.5 py-1 ${
                  lbScope === 'friends' ? 'bg-emerald-500 font-semibold text-slate-950' : 'text-slate-300'
                }`}
              >
                Bạn bè
              </button>
            </div>
          </div>

          {entries.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">Chưa có dữ liệu xếp hạng.</p>
          ) : (
            <div className="space-y-1.5">
              {entries.map((entry, idx) => {
                const av = getAvatarById(entry.avatarId);
                return (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 font-mono font-bold text-amber-300">#{idx + 1}</span>
                      <span>{av.emoji}</span>
                      <span className="font-medium text-white">{entry.username}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">
                        {entry.wins}W/{entry.losses}L
                      </span>
                      <span className="font-mono font-bold text-emerald-300">{entry.elo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
