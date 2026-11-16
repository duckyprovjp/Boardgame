'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getAvatarById, getGameCatalogItem, type UserGameStats } from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';
import { AvatarPicker } from '@/components/AvatarPicker';
import { authApi, progressionApi } from '@/lib/api';

export default function ProfilePage() {
  const { user, loadingAuth, setAuthSession, logout, socketConnected } = useApp();
  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState('fox');
  const [stats, setStats] = useState<UserGameStats[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username);
    setAvatarId(user.avatarId);
    progressionApi
      .me()
      .then((res) => setStats(res.stats))
      .catch(() => undefined);
  }, [user]);

  if (loadingAuth || !user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-slate-400">
        Đang tải hồ sơ...
      </main>
    );
  }

  const av = getAvatarById(user.avatarId);
  const xpInLevel = user.xp % 100;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setSaving(true);
    try {
      const res = await authApi.updateProfile({ username, avatarId });
      setAuthSession(res.user);
      setMsg('Đã cập nhật hồ sơ thành công!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${av.bgClass}`}
            >
              {av.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{user.username}</h1>
                <span className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  Cấp {user.level}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {user.email ?? 'Tài khoản khách'} · Socket:{' '}
                {socketConnected ? 'Đã kết nối' : 'Chưa kết nối'}
              </p>
              <div className="mt-2 w-48">
                <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                  <span>XP: {user.xp}</span>
                  <span>{xpInLevel}/100 XP</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${xpInLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="cursor-pointer rounded-xl border border-rose-500/40 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
          >
            Đăng xuất
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="mb-4 text-base font-bold text-white">Chỉnh sửa hồ sơ</h2>
        {msg && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {msg}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Tên người dùng
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300">Ảnh đại diện</label>
            <AvatarPicker value={avatarId} onChange={setAvatarId} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="mb-3 text-base font-bold text-white">Điểm xếp hạng theo trò chơi</h2>
        {stats.length === 0 ? (
          <p className="text-xs text-slate-400">Chưa có trận đấu nào.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {stats.map((s) => (
              <div
                key={s.gameId}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-white">{getGameCatalogItem(s.gameId).name}</p>
                  <p className="text-slate-400">
                    {s.wins} thắng · {s.losses} thua
                  </p>
                </div>
                <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-mono font-bold text-emerald-300">
                  {s.elo}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
