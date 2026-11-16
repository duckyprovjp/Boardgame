'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  getAvatarById,
  getGameCatalogItem,
  type AuthUser,
  type MatchStatusPayload,
  type RoomChatMessage,
  type RoomInvitePayload,
  type RoomState,
} from '@boardgame/shared';
import { authApi } from '@/lib/api';
import { createSocket } from '@/lib/socket';
import { isSoundEnabled, playSound, setSoundEnabled } from '@/lib/sound';

interface AppContextValue {
  user: AuthUser | null;
  loadingAuth: boolean;
  socket: Socket | null;
  socketConnected: boolean;
  room: RoomState | null;
  setRoom: (room: RoomState | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameView: any | null;
  turnEndsAt: number | null;
  matchStatus: MatchStatusPayload;
  setMatchStatus: (s: MatchStatusPayload) => void;
  refreshUser: () => Promise<void>;
  setAuthSession: (user: AuthUser, socketToken?: string | null) => void;
  logout: () => Promise<void>;
  soundOn: boolean;
  toggleSound: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

const PUBLIC_ROUTES = new Set(['/', '/login', '/register']);

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const socketRef = useRef<Socket | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [socketToken, setSocketToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const [room, setRoom] = useState<RoomState | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [gameView, setGameView] = useState<any | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatusPayload>({ status: 'idle' });
  const [invitePopup, setInvitePopup] = useState<RoomInvitePayload | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.user);
      if (res.socketToken) setSocketToken(res.socketToken);
    } catch {
      setUser(null);
      setSocketToken(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Route guard: unauthenticated users on protected routes -> /login
  useEffect(() => {
    if (loadingAuth) return;
    if (!user && !PUBLIC_ROUTES.has(pathname)) {
      router.replace('/login');
    }
  }, [loadingAuth, user, pathname, router]);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocketInstance(null);
      setSocketConnected(false);
      setRoom(null);
      setGameView(null);
      return;
    }

    const socket = createSocket(socketToken);
    socketRef.current = socket;
    setSocketInstance(socket);

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    socket.on(SOCKET_EVENTS.ROOM_STATE, (nextRoom: RoomState) => {
      setRoom(nextRoom);
      if (nextRoom.status === 'lobby') {
        setGameView(null);
        setTurnEndsAt(null);
      }
    });

    socket.on(SOCKET_EVENTS.ROOM_STARTING, (payload: { code: string }) => {
      router.push(`/play/${payload.code}`);
    });

    socket.on(SOCKET_EVENTS.ROOM_CHAT_MESSAGE, (msg: RoomChatMessage) => {
      setRoom((prev) => (prev ? { ...prev, chat: [...prev.chat, msg] } : prev));
    });

    socket.on(SOCKET_EVENTS.ROOM_KICKED, () => {
      setRoom(null);
      setGameView(null);
      router.push('/games');
    });

    socket.on(SOCKET_EVENTS.ROOM_INVITE_RECEIVED, (invite: RoomInvitePayload) => {
      setInvitePopup(invite);
    });

    socket.on(SOCKET_EVENTS.GAME_STATE, (payload: { view: unknown; turnEndsAt: number | null }) => {
      setGameView(payload.view);
      setTurnEndsAt(payload.turnEndsAt);
      const v = payload.view as { isGameOver?: boolean; currentTurnPlayerId?: string | null };
      if (v?.isGameOver) {
        playSound('win');
      } else if (v?.currentTurnPlayerId === user.id) {
        playSound('turn');
      }
    });

    socket.on(SOCKET_EVENTS.MATCH_STATUS, (status: MatchStatusPayload) => {
      setMatchStatus(status);
    });

    socket.on(SOCKET_EVENTS.MATCH_FOUND, (payload: { room: RoomState }) => {
      setRoom(payload.room);
      setMatchStatus({ status: 'idle' });
      router.push(`/play/${payload.room.code}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, [user, socketToken, router]);

  const setAuthSession = (nextUser: AuthUser, nextToken?: string | null) => {
    setUser(nextUser);
    if (nextToken !== undefined) setSocketToken(nextToken);
  };

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
    setSocketToken(null);
    setRoom(null);
    setGameView(null);
    router.push('/login');
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const isSeatedInRunningGame =
    Boolean(user && room && room.status === 'in_game') &&
    pathname !== `/play/${room?.code}`;

  const acceptInvite = (code: string) => {
    if (!socketInstance) return;
    socketInstance.emit(
      SOCKET_EVENTS.ROOM_JOIN,
      { code },
      (res: { ok: boolean; room?: RoomState }) => {
        if (res.ok && res.room) {
          setRoom(res.room);
          setInvitePopup(null);
          router.push(`/rooms/${res.room.code}`);
        }
      },
    );
  };

  return (
    <AppContext.Provider
      value={{
        user,
        loadingAuth,
        socket: socketInstance,
        socketConnected,
        room,
        setRoom,
        gameView,
        turnEndsAt,
        matchStatus,
        setMatchStatus,
        refreshUser,
        setAuthSession,
        logout,
        soundOn,
        toggleSound,
      }}
    >
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Top Navbar */}
        <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-bold tracking-tight text-white"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-black text-slate-950">
                BG
              </span>
              <span className="hidden sm:inline">Bàn Chơi Trực Tuyến</span>
            </Link>

            {user ? (
              <nav className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2">
                <Link
                  href="/games"
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                    pathname.startsWith('/games')
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Trò chơi
                </Link>
                <Link
                  href="/friends"
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                    pathname === '/friends'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Bạn bè
                </Link>
                <Link
                  href="/leaderboard"
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                    pathname === '/leaderboard'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Xếp hạng
                </Link>
                <Link
                  href="/history"
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                    pathname === '/history'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Lịch sử
                </Link>
                <Link
                  href="/profile"
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition ${
                    pathname === '/profile'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{getAvatarById(user.avatarId).emoji}</span>
                  <span>{user.username}</span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    Lv.{user.level}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-label={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
                  className="cursor-pointer rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {soundOn ? 'Âm: Bật' : 'Âm: Tắt'}
                </button>
              </nav>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-700 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Return to active table banner */}
        {isSeatedInRunningGame && room && (
          <div className="border-b border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-xs">
              <span className="font-medium text-emerald-200">
                Bạn đang có ván <strong>{getGameCatalogItem(room.gameId).name}</strong> đang diễn ra
                (Phòng {room.code}).
              </span>
              <Link
                href={`/play/${room.code}`}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Quay lại bàn
              </Link>
            </div>
          </div>
        )}

        {/* Realtime Friend Invite Popup */}
        {invitePopup && (
          <div className="mx-auto max-w-6xl px-4 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-xs">
              <span className="text-amber-200">
                <strong>{invitePopup.fromUser.username}</strong> mời bạn vào phòng{' '}
                <strong className="font-mono">{invitePopup.roomCode}</strong> (
                {getGameCatalogItem(invitePopup.gameId).name})
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => acceptInvite(invitePopup.roomCode)}
                  className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Tham gia
                </button>
                <button
                  type="button"
                  onClick={() => setInvitePopup(null)}
                  className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1 text-slate-300 hover:bg-slate-800"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          </div>
        )}

        {children}
      </div>
    </AppContext.Provider>
  );
}
