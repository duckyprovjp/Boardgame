'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { AvatarPicker } from '@/components/AvatarPicker';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { user, setAuthSession } = useApp();
  const [mode, setMode] = useState<'login' | 'guest'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [avatarId, setAvatarId] = useState('fox');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace('/games');
  }, [user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res =
        mode === 'login'
          ? await authApi.login({ identifier, password })
          : await authApi.guest({
              username: guestName.trim() ? guestName.trim() : undefined,
              avatarId,
            });
      setAuthSession(res.user, res.socketToken ?? null);
      router.push('/games');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white">Đăng nhập</h1>
        <p className="mt-1 text-xs text-slate-400">
          Vào bàn chơi bằng tài khoản hoặc chế độ khách
        </p>

        <div className="my-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`cursor-pointer rounded-lg py-2 font-semibold transition ${
              mode === 'login' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
            }`}
          >
            Tài khoản
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('guest');
              setError(null);
            }}
            className={`cursor-pointer rounded-lg py-2 font-semibold transition ${
              mode === 'guest' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
            }`}
          >
            Chơi khách
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'login' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Email hoặc Tên người dùng
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ten_nguoi_choi hoặc email"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Tên hiển thị (tuỳ chọn)
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Để trống để tạo tự động"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-300">
                  Chọn ảnh đại diện
                </label>
                <AvatarPicker value={avatarId} onChange={setAvatarId} />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Vào chơi ngay'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="font-semibold text-amber-400 hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </section>
    </main>
  );
}
