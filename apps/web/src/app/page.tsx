'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GAME_CATALOG, PongPayloadSchema, SOCKET_EVENTS, type PingPayload } from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';

export default function LandingPage() {
  const { user, socket, socketConnected } = useApp();
  const [pongMs, setPongMs] = useState<number | null>(null);

  useEffect(() => {
    if (!socket || !socketConnected) return;
    const onPong = (raw: unknown) => {
      const parsed = PongPayloadSchema.safeParse(raw);
      if (parsed.success) {
        setPongMs(Math.max(0, Date.now() - parsed.data.clientTime));
      }
    };
    socket.on(SOCKET_EVENTS.PONG, onPong);
    socket.emit(SOCKET_EVENTS.PING, { clientTime: Date.now(), message: 'landing' } satisfies PingPayload);
    return () => {
      socket.off(SOCKET_EVENTS.PONG, onPong);
    };
  }, [socket, socketConnected]);

  const featuredGames = GAME_CATALOG.filter((g) => g.featured);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl border border-stone-800 bg-gradient-to-br from-stone-900 via-slate-900 to-stone-950 p-6 shadow-2xl sm:p-10">
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            Chơi bài &amp; Tiệc tùng trực tuyến thời gian thực
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Bàn Chơi Trực Tuyến
          </h1>
          <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
            Tạo phòng riêng cùng bạn bè hoặc ghép trận nhanh với người chơi khác. Không tiền tệ,
            không nạp rút — chỉ có kỹ năng, chiến thuật, XP và bảng xếp hạng công bằng.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {user ? (
              <Link
                href="/games"
                className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
              >
                Chọn trò chơi ngay
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                >
                  Đăng nhập / Chơi khách
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  Tạo tài khoản
                </Link>
              </>
            )}

            {user && (
              <span className="text-xs text-slate-400">
                Socket:{' '}
                <strong className={socketConnected ? 'text-emerald-400' : 'text-rose-400'}>
                  {socketConnected ? `Đã kết nối${pongMs !== null ? ` (${pongMs}ms)` : ''}` : 'Đang kết nối...'}
                </strong>
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-white">Hai trò chơi nổi bật</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {featuredGames.map((g) => (
            <div
              key={g.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-amber-500/40"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold text-white">{g.name}</h3>
                  <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-amber-300">
                    {g.minPlayers}–{g.maxPlayers} người
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{g.description}</p>
              </div>
              <div className="mt-5">
                <Link
                  href={user ? `/games/${g.id}` : '/login'}
                  className="inline-block rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
                >
                  Vào sảnh {g.name}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
