'use client';

import { useEffect, useState } from 'react';
import { getGameCatalogItem, type GameId, type MatchHistoryEntry } from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';
import { progressionApi } from '@/lib/api';

export default function HistoryPage() {
  const { user, loadingAuth } = useApp();
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    progressionApi
      .me()
      .then((res) => setHistory(res.history))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loadingAuth || !user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 text-center text-sm text-slate-400">
        Đang tải lịch sử đấu...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Lịch sử đấu</h1>
        <p className="text-xs text-slate-400">Các trận đấu bạn đã tham gia gần đây</p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        {loading ? (
          <p className="py-8 text-center text-xs text-slate-400">Đang tải...</p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">Bạn chưa hoàn thành trận nào.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {getGameCatalogItem(h.gameId as GameId).name}{' '}
                    <span className="ml-1 font-mono text-slate-400">#{h.roomCode}</span>
                  </p>
                  <p className="text-slate-400">
                    {new Date(h.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <span
                  className={`rounded-lg px-3 py-1 font-bold ${
                    h.won
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {h.won ? 'Thắng (Hạng #1)' : `Hạng #${h.rank}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
