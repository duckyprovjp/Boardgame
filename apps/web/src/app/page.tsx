'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Socket } from 'socket.io-client';
import {
  PongPayloadSchema,
  SOCKET_EVENTS,
  getAvatarById,
  type AuthUser,
  type PingPayload,
  type PongPayload,
} from '@boardgame/shared';
import { AvatarPicker } from '@/components/AvatarPicker';
import { FriendsPanel } from '@/components/FriendsPanel';
import { LobbyPanel } from '@/components/LobbyPanel';
import { ProgressionPanel } from '@/components/ProgressionPanel';
import { authApi } from '@/lib/api';
import { createSocket } from '@/lib/socket';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound';

type AuthTab = 'login' | 'register' | 'guest';

export default function HomePage() {
  const socketRef = useRef<Socket | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState('fox');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarId, setEditAvatarId] = useState('fox');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [socketConnected, setSocketConnected] = useState(false);
  const [socketUser, setSocketUser] = useState<AuthUser | null>(null);
  const [pongData, setPongData] = useState<PongPayload | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  useEffect(() => {
    authApi
      .me()
      .then((res) => {
        setUser(res.user);
        setEditUsername(res.user.username);
        setEditAvatarId(res.user.avatarId);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  }, []);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocketConnected(false);
      setSocketUser(null);
      setPongData(null);
      setLatencyMs(null);
      return;
    }

    const socket = createSocket();
    socketRef.current = socket;
    setSocketInstance(socket);

    socket.on('connect', () => {
      setSocketConnected(true);
      const payload: PingPayload = {
        clientTime: Date.now(),
        message: 'auto ping',
      };
      socket.emit(SOCKET_EVENTS.PING, payload);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('connect_error', () => {
      setSocketConnected(false);
    });

    socket.on(SOCKET_EVENTS.AUTH_READY, (authPayload: AuthUser) => {
      setSocketUser(authPayload);
    });

    socket.on(SOCKET_EVENTS.PONG, (raw: unknown) => {
      const parsed = PongPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      setPongData(parsed.data);
      setLatencyMs(Math.max(0, Date.now() - parsed.data.clientTime));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, [user]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let res: { user: AuthUser };
      if (tab === 'login') {
        res = await authApi.login({ email, password });
      } else if (tab === 'register') {
        res = await authApi.register({ email, password, username, avatarId });
      } else {
        res = await authApi.guest({
          username: username.trim() ? username.trim() : undefined,
          avatarId,
        });
      }
      setUser(res.user);
      setEditUsername(res.user.username);
      setEditAvatarId(res.user.avatarId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setProfileMsg(null);
    setSubmitting(true);

    try {
      const res = await authApi.updateProfile({
        username: editUsername,
        avatarId: editAvatarId,
      });
      setUser(res.user);
      setEditingProfile(false);
      setProfileMsg('Đã cập nhật hồ sơ thành công');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật hồ sơ thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
    setEditingProfile(false);
    setProfileMsg(null);
    setError(null);
  };

  const sendPing = () => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit(SOCKET_EVENTS.PING, {
      clientTime: Date.now(),
      message: 'xin chao',
    } satisfies PingPayload);
  };

  if (loadingAuth) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-8 text-center text-sm text-slate-300">
          Đang kiểm tra phiên đăng nhập...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Giai đoạn 1 — Tài khoản & Hồ sơ
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              Bàn Chơi Trực Tuyến
            </h1>
          </div>

          {user && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !soundOn;
                  setSoundOn(next);
                  setSoundEnabled(next);
                }}
                aria-label={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
              >
                {soundOn ? '🔊 Âm thanh' : '🔇 Tắt tiếng'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </header>

        {!user ? (
          <div>
            <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-950/70 p-1">
              {(
                [
                  ['login', 'Đăng nhập'],
                  ['register', 'Đăng ký'],
                  ['guest', 'Chơi khách'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setError(null);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition sm:text-sm ${
                    tab === key
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {tab !== 'guest' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nguoi_choi@example.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              {tab !== 'login' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    {tab === 'guest' ? 'Tên hiển thị (tuỳ chọn)' : 'Tên người dùng'}
                  </label>
                  <input
                    type="text"
                    required={tab === 'register'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={tab === 'guest' ? 'Để trống để tạo tự động' : 'vi_du_123'}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              {tab !== 'guest' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    minLength={tab === 'register' ? 6 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              {tab !== 'login' && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-300">
                    Chọn ảnh đại diện
                  </label>
                  <AvatarPicker value={avatarId} onChange={setAvatarId} />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {submitting
                  ? 'Đang xử lý...'
                  : tab === 'login'
                    ? 'Đăng nhập'
                    : tab === 'register'
                      ? 'Tạo tài khoản'
                      : 'Vào chơi ngay'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}
            {profileMsg && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {profileMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
                    getAvatarById(user.avatarId).bgClass
                  }`}
                >
                  {getAvatarById(user.avatarId).emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{user.username}</span>
                    {user.isGuest && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        Khách
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {user.email ?? 'Tài khoản chơi nhanh tạm thời'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingProfile((prev) => !prev);
                  setEditUsername(user.username);
                  setEditAvatarId(user.avatarId);
                  setError(null);
                  setProfileMsg(null);
                }}
                className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
              >
                {editingProfile ? 'Huỷ' : 'Chỉnh sửa hồ sơ'}
              </button>
            </div>

            {editingProfile && (
              <form
                onSubmit={handleProfileSave}
                className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Tên người dùng mới
                  </label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-300">
                    Ảnh đại diện
                  </label>
                  <AvatarPicker value={editAvatarId} onChange={setEditAvatarId} />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </form>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">Kết nối Socket xác thực</p>
                <p className="mt-1 text-base font-semibold">
                  {socketConnected ? (
                    <span className="text-emerald-400">Đã xác thực</span>
                  ) : (
                    <span className="text-rose-400">Chưa kết nối</span>
                  )}
                </p>
                {socketUser && (
                  <p className="mt-1 text-xs text-slate-400">
                    Tài khoản socket: {socketUser.username}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">Phản hồi Ping / Pong</p>
                <p className="mt-1 text-base font-semibold text-white">
                  {pongData ? (
                    <span className="text-emerald-400">{pongData.message}</span>
                  ) : (
                    <span className="text-slate-500">Đang chờ...</span>
                  )}
                </p>
                {latencyMs !== null && (
                  <p className="mt-1 text-xs text-slate-400">Độ trễ: {latencyMs} ms</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={sendPing}
              disabled={!socketConnected}
              className="w-full rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 sm:w-auto"
            >
              Gửi Ping lại
            </button>
          </div>
        )}
      </section>

      {user && (
        <div className="mt-6 space-y-6">
          <LobbyPanel socket={socketInstance} currentUserId={user.id} />
          <FriendsPanel socket={socketInstance} />
          <ProgressionPanel />
        </div>
      )}
    </main>
  );
}
