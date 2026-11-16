'use client';

import Link from 'next/link';
import { GAME_CATALOG } from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';

export default function GamesPage() {
  const { user, loadingAuth } = useApp();

  if (loadingAuth || !user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-400">
        Đang tải danh sách trò chơi...
      </main>
    );
  }

  const featured = GAME_CATALOG.filter((g) => g.featured);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Chọn trò chơi</h1>
        <p className="mt-1 text-xs text-slate-400">
          Chọn sảnh để tạo phòng riêng, tham gia bàn công khai hoặc ghép trận nhanh
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {featured.map((game) => (
          <Link
            key={game.id}
            href={`/games/${game.id}`}
            className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 transition hover:border-amber-400/60 hover:bg-slate-900"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-white group-hover:text-amber-300">
                  {game.name}
                </h2>
                <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-amber-300">
                  {game.minPlayers}–{game.maxPlayers} người
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{game.description}</p>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs font-semibold text-amber-400">
              <span>Vào sảnh chờ</span>
              <span>→</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
