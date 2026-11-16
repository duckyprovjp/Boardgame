'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { AvatarPicker } from '@/components/AvatarPicker';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const { user, setAuthSession } = useApp();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      const res = await authApi.register({ email, password, username, avatarId });
      setAuthSession(res.user, res.socketToken ?? null);
      router.push('/games');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white">Tạo tài khoản</h1>
        <p className="mt-1 text-xs text-slate-400">Lưu tiến trình XP, cấp độ và bảng xếp hạng</p>

        {error && (
          <div className="my-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nguoi_choi@example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Tên người dùng (duy nhất)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vi_du_123"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Mật khẩu</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300">
              Chọn ảnh đại diện
            </label>
            <AvatarPicker value={avatarId} onChange={setAvatarId} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? 'Đang tạo...' : 'Đăng ký'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Đã có tài khoản?{' '}
          <Link href="/login" className="font-semibold text-amber-400 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </section>
    </main>
  );
}
