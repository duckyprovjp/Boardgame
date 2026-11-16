'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Socket } from 'socket.io-client';
import {
  GAME_CATALOG,
  SOCKET_EVENTS,
  getAvatarById,
  getGameCatalogItem,
  type ColorUnoPlayerView,
  type DiceFatePlayerView,
  type FriendInfo,
  type GameId,
  type HighCardPlayerView,
  type MatchStatusPayload,
  type MeoNoPlayerView,
  type PublicRoomSummary,
  type RoomChatMessage,
  type RoomInvitePayload,
  type RoomState,
  type RoomVisibility,
} from '@boardgame/shared';
import { GameTable, type GameTableSeat } from '@/components/GameTable';
import { ColorUnoBoard } from '@/components/games/ColorUnoBoard';
import { DiceFateBoard } from '@/components/games/DiceFateBoard';
import { HighCardBoard } from '@/components/games/HighCardBoard';
import { MeoNoBoard } from '@/components/games/MeoNoBoard';
import { friendsApi, roomsApi } from '@/lib/api';
import { playSound } from '@/lib/sound';

interface LobbyPanelProps {
  socket: Socket | null;
  currentUserId: string;
}

interface AckResponse {
  ok: boolean;
  error?: string;
  room?: RoomState;
}

export function LobbyPanel({ socket, currentUserId }: LobbyPanelProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [gameId, setGameId] = useState<GameId>('high-card');
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [visibility, setVisibility] = useState<RoomVisibility>('private');
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [invitePopup, setInvitePopup] = useState<RoomInvitePayload | null>(null);
  const [onlineFriends, setOnlineFriends] = useState<FriendInfo[]>([]);
  const [gameView, setGameView] = useState<
    HighCardPlayerView | ColorUnoPlayerView | MeoNoPlayerView | DiceFatePlayerView | null
  >(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatusPayload>({ status: 'idle' });
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [mutedUserIds, setMutedUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    const onRoomState = (nextRoom: RoomState) => {
      setRoom(nextRoom);
      if (nextRoom.status === 'lobby') {
        setGameView(null);
        setTurnEndsAt(null);
      }
      setError(null);
    };

    const onGameState = (payload: {
      view: HighCardPlayerView | ColorUnoPlayerView | MeoNoPlayerView | DiceFatePlayerView;
      turnEndsAt: number | null;
    }) => {
      setGameView(payload.view);
      setTurnEndsAt(payload.turnEndsAt);
      if (payload.view.isGameOver) {
        playSound('win');
      } else if (payload.view.currentTurnPlayerId === currentUserId) {
        playSound('turn');
      }
    };

    const onChatMessage = (msg: RoomChatMessage) => {
      setRoom((prev) => (prev ? { ...prev, chat: [...prev.chat, msg] } : prev));
    };

    const onKicked = (payload: { reason?: string }) => {
      setRoom(null);
      setError(payload.reason ?? 'Bạn đã bị mời ra khỏi phòng');
    };

    const onInviteReceived = (invite: RoomInvitePayload) => {
      setInvitePopup(invite);
    };

    const onMatchStatus = (status: MatchStatusPayload) => {
      setMatchStatus(status);
    };

    const onMatchFound = (payload: { room: RoomState }) => {
      setRoom(payload.room);
      setMatchStatus({ status: 'idle' });
    };

    socket.on(SOCKET_EVENTS.ROOM_STATE, onRoomState);
    socket.on(SOCKET_EVENTS.ROOM_CHAT_MESSAGE, onChatMessage);
    socket.on(SOCKET_EVENTS.ROOM_KICKED, onKicked);
    socket.on(SOCKET_EVENTS.ROOM_INVITE_RECEIVED, onInviteReceived);
    socket.on(SOCKET_EVENTS.GAME_STATE, onGameState);
    socket.on(SOCKET_EVENTS.MATCH_STATUS, onMatchStatus);
    socket.on(SOCKET_EVENTS.MATCH_FOUND, onMatchFound);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_STATE, onRoomState);
      socket.off(SOCKET_EVENTS.ROOM_CHAT_MESSAGE, onChatMessage);
      socket.off(SOCKET_EVENTS.ROOM_KICKED, onKicked);
      socket.off(SOCKET_EVENTS.ROOM_INVITE_RECEIVED, onInviteReceived);
      socket.off(SOCKET_EVENTS.GAME_STATE, onGameState);
      socket.off(SOCKET_EVENTS.MATCH_STATUS, onMatchStatus);
      socket.off(SOCKET_EVENTS.MATCH_FOUND, onMatchFound);
    };
  }, [socket]);

  useEffect(() => {
    if (!room) return;
    friendsApi
      .list()
      .then((res) => setOnlineFriends(res.friends.filter((f) => f.presence !== 'offline')))
      .catch(() => undefined);
  }, [room]);

  const handleGameChange = (nextId: GameId) => {
    setGameId(nextId);
    const g = getGameCatalogItem(nextId);
    setMaxPlayers((prev) => Math.min(Math.max(prev, g.minPlayers), g.maxPlayers));
  };

  const handleCreateRoom = (e: FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    setError(null);
    socket.emit(
      SOCKET_EVENTS.ROOM_CREATE,
      { gameId, maxPlayers, visibility },
      (res: AckResponse) => {
        if (!res.ok) {
          setError(res.error ?? 'Không thể tạo phòng');
        } else if (res.room) {
          setRoom(res.room);
        }
      },
    );
  };

  const joinByCode = (code: string) => {
    if (!socket) return;
    setError(null);
    socket.emit(
      SOCKET_EVENTS.ROOM_JOIN,
      { code: code.trim().toUpperCase() },
      (res: AckResponse) => {
        if (!res.ok) {
          setError(res.error ?? 'Không thể vào phòng');
        } else if (res.room) {
          setRoom(res.room);
          setInvitePopup(null);
        }
      },
    );
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    joinByCode(joinCode);
  };

  const handleLeave = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.ROOM_LEAVE, {}, (res: AckResponse) => {
      if (res.ok) setRoom(null);
    });
  };

  const handleToggleReady = () => {
    if (!socket || !room) return;
    const me = room.members.find((m) => m.id === currentUserId);
    if (!me) return;
    socket.emit(SOCKET_EVENTS.ROOM_READY, { isReady: !me.isReady }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Không thể đổi trạng thái');
    });
  };

  const handleKick = (targetUserId: string) => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.ROOM_KICK, { targetUserId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Không thể đuổi người chơi');
    });
  };

  const handleTransferHost = (targetUserId: string) => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.ROOM_TRANSFER_HOST, { targetUserId }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Không thể chuyển chủ phòng');
    });
  };

  const handleInviteFriend = (targetUserId: string) => {
    if (!socket || !room) return;
    socket.emit(
      SOCKET_EVENTS.ROOM_INVITE,
      { targetUserId, roomCode: room.code },
      (res: AckResponse) => {
        if (!res.ok) setError(res.error ?? 'Không thể gửi lời mời');
      },
    );
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!socket || !chatInput.trim()) return;
    socket.emit(SOCKET_EVENTS.ROOM_CHAT_SEND, { text: chatInput.trim() }, (res: AckResponse) => {
      if (!res.ok) {
        setError(res.error ?? 'Không thể gửi tin nhắn');
      } else {
        setChatInput('');
      }
    });
  };

  const handleStart = () => {
    if (!socket) return;
    setError(null);
    socket.emit(SOCKET_EVENTS.ROOM_START, {}, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Không thể bắt đầu');
    });
  };

  const handleGameAction = (action: Record<string, unknown>) => {
    if (!socket || !room) return;
    setError(null);
    playSound('card');
    socket.emit(
      SOCKET_EVENTS.GAME_ACTION,
      { roomCode: room.code, action },
      (res: AckResponse) => {
        if (!res.ok) setError(res.error ?? 'Hành động không hợp lệ');
      },
    );
  };

  const loadPublicRooms = () => {
    roomsApi
      .listPublic()
      .then((res) => setPublicRooms(res.rooms))
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!room) {
      loadPublicRooms();
    }
  }, [room]);

  const handleJoinQueue = () => {
    if (!socket) return;
    setError(null);
    socket.emit(
      SOCKET_EVENTS.MATCH_JOIN_QUEUE,
      { gameId, playerCount: maxPlayers },
      (res: AckResponse) => {
        if (!res.ok) setError(res.error ?? 'Không thể tìm trận');
      },
    );
  };

  const handleCancelQueue = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.MATCH_CANCEL_QUEUE, {}, () => {
      setMatchStatus({ status: 'idle' });
    });
  };

  const handleFillBots = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.MATCH_FILL_BOTS, {}, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Không thể ghép Bot');
    });
  };

  const handleReturnLobby = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.GAME_RETURN_LOBBY, {}, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Không thể quay lại sảnh');
    });
  };

  const selectedGame = getGameCatalogItem(gameId);
  const currentMember = room?.members.find((m) => m.id === currentUserId);
  const isHost = room?.hostId === currentUserId;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-white">Phòng chơi & Sảnh chờ</h2>
        {room && (
          <span className="rounded-lg bg-slate-800 px-3 py-1 font-mono text-sm font-bold tracking-widest text-emerald-300">
            {room.code}
          </span>
        )}
      </div>

      {invitePopup && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3">
          <p className="text-sm text-emerald-200">
            <strong>{invitePopup.fromUser.username}</strong> mời bạn vào phòng{' '}
            <span className="font-mono font-bold">{invitePopup.roomCode}</span> (
            {getGameCatalogItem(invitePopup.gameId).name})
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => joinByCode(invitePopup.roomCode)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Tham gia
            </button>
            <button
              type="button"
              onClick={() => setInvitePopup(null)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {!room ? (
        <div className="space-y-6">
          {/* Quick Play Matchmaking */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-emerald-300">Ghép trận ngẫu nhiên</h3>
                <p className="text-xs text-slate-400">
                  Tìm nhanh người chơi khác theo trò chơi ({selectedGame.name}) và số lượng ({maxPlayers} người)
                </p>
              </div>
              {matchStatus.status === 'idle' || matchStatus.status === 'matched' ? (
                <button
                  type="button"
                  onClick={handleJoinQueue}
                  disabled={!socket}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  Tìm trận nhanh
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-amber-300">
                    {matchStatus.status === 'timeout'
                      ? 'Chưa đủ người — có thể thêm Bot!'
                      : `Đang tìm (${matchStatus.queueSize ?? 1}/${matchStatus.playerCount ?? maxPlayers})...`}
                  </span>
                  <button
                    type="button"
                    onClick={handleFillBots}
                    className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300"
                  >
                    Chơi với Bot
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelQueue}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Huỷ
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
          <form
            onSubmit={handleCreateRoom}
            className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4"
          >
            <h3 className="text-sm font-semibold text-white">Tạo phòng mới</h3>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Trò chơi</label>
              <select
                value={gameId}
                onChange={(e) => handleGameChange(e.target.value as GameId)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              >
                {GAME_CATALOG.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.minPlayers}-{g.maxPlayers} người)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Số người tối đa</label>
                <input
                  type="number"
                  min={selectedGame.minPlayers}
                  max={selectedGame.maxPlayers}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Chế độ</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as RoomVisibility)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                >
                  <option value="private">Riêng tư</option>
                  <option value="public">Công khai</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!socket}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              Tạo phòng
            </button>
          </form>

          <form
            onSubmit={handleJoinSubmit}
            className="flex flex-col justify-between space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4"
          >
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Vào phòng bằng mã</h3>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Mã phòng (6 ký tự)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="VD: AB23CD"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm uppercase tracking-widest text-white outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!socket || joinCode.trim().length !== 6}
              className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Tham gia phòng
            </button>
          </form>
          </div>

          {/* Public Room Browser */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Phòng công khai đang mở</h3>
              <button
                type="button"
                onClick={loadPublicRooms}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Làm mới
              </button>
            </div>
            {publicRooms.length === 0 ? (
              <p className="text-xs text-slate-500">Hiện chưa có phòng công khai nào.</p>
            ) : (
              <div className="space-y-2">
                {publicRooms.map((pr) => (
                  <div
                    key={pr.code}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">
                        {getGameCatalogItem(pr.gameId).name}
                      </span>{' '}
                      <span className="text-slate-400">
                        · Chủ phòng: {pr.hostUsername} ({pr.memberCount}/{pr.maxPlayers})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => joinByCode(pr.code)}
                      className="rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-slate-950 hover:bg-emerald-400"
                    >
                      Vào ({pr.code})
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : room.status === 'in_game' && gameView ? (
          <GameTable
            title={getGameCatalogItem(room.gameId).name}
            roomCode={room.code}
            seats={gameView.players.map(
              (p): GameTableSeat => ({
                id: p.id,
                username: p.username,
                avatarId: p.avatarId,
                isCurrentTurn: gameView.currentTurnPlayerId === p.id,
                sublabel:
                  'lives' in p
                    ? `❤️ ${p.lives} · 🛡️ ${p.shields} · ${p.cardCount} lá`
                    : `${p.cardCount} lá trên tay`,
                badge:
                  'calledLastCard' in p && p.calledLastCard && p.cardCount === 1
                    ? 'CÒN 1 LÁ!'
                    : undefined,
              }),
            )}
            myPlayerId={currentUserId}
            turnEndsAt={turnEndsAt}
            actionLog={gameView.actionLog}
            isGameOver={gameView.isGameOver}
            result={gameView.result}
            isHost={isHost}
            onReturnLobby={handleReturnLobby}
            onLeaveRoom={handleLeave}
          >
            {gameView.gameId === 'high-card' && (
              <HighCardBoard view={gameView} onAction={handleGameAction} />
            )}
            {gameView.gameId === 'color-uno' && (
              <ColorUnoBoard view={gameView} onAction={handleGameAction} />
            )}
            {gameView.gameId === 'meo-no' && (
              <MeoNoBoard view={gameView} onAction={handleGameAction} />
            )}
            {gameView.gameId === 'dice-fate' && (
              <DiceFateBoard view={gameView} onAction={handleGameAction} />
            )}
          </GameTable>
      ) : room.status === 'starting' ? (
        <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <p className="text-xl font-bold text-emerald-300">Trận đấu đang bắt đầu...</p>
          <p className="text-sm text-slate-300">
            Trò chơi: <strong>{getGameCatalogItem(room.gameId).name}</strong> ·{' '}
            {room.members.length} người chơi
          </p>
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800"
          >
            Rời phòng
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="text-sm">
              <span className="font-semibold text-white">
                {getGameCatalogItem(room.gameId).name}
              </span>
              <span className="ml-2 text-xs text-slate-400">
                ({room.members.length}/{room.maxPlayers} người ·{' '}
                {room.visibility === 'public' ? 'Công khai' : 'Riêng tư'})
              </span>
            </div>
            <button
              type="button"
              onClick={handleLeave}
              className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/10"
            >
              Rời phòng
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Thành viên trong phòng
              </h3>
              {room.members.map((m) => {
                const av = getAvatarById(m.avatarId);
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{av.emoji}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white">{m.username}</span>
                          {m.isHost && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              Chủ phòng
                            </span>
                          )}
                          {!m.connected && (
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">
                              Mất kết nối
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[11px] ${
                            m.isReady ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {m.isReady ? 'Đã sẵn sàng' : 'Chưa sẵn sàng'}
                        </span>
                      </div>
                    </div>

                    {isHost && m.id !== currentUserId && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTransferHost(m.id)}
                          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                          Chuyển chủ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKick(m.id)}
                          className="rounded border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10"
                        >
                          Đuổi
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {onlineFriends.length > 0 && (
                <div className="pt-2">
                  <p className="mb-1.5 text-xs text-slate-400">Mời bạn trực tuyến:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {onlineFriends
                      .filter((f) => !room.members.some((m) => m.id === f.id))
                      .map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleInviteFriend(f.id)}
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-400"
                        >
                          + Mời {f.username}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Trò chuyện phòng
              </h3>
              <div className="mb-3 h-44 flex-1 space-y-1.5 overflow-y-auto text-xs">
                {room.chat.filter((m) => !mutedUserIds.includes(m.senderId)).length === 0 ? (
                  <p className="text-slate-500">Chưa có tin nhắn nào.</p>
                ) : (
                  room.chat
                    .filter((m) => !mutedUserIds.includes(m.senderId))
                    .map((msg) => (
                      <div key={msg.id} className="flex items-center justify-between gap-2 break-words text-slate-200">
                        <div>
                          <span className="font-semibold text-emerald-300">
                            {msg.senderUsername}:{' '}
                          </span>
                          <span>{msg.text}</span>
                        </div>
                        {msg.senderId !== currentUserId && (
                          <button
                            type="button"
                            onClick={() =>
                              setMutedUserIds((prev) =>
                                prev.includes(msg.senderId) ? prev : [...prev, msg.senderId],
                              )
                            }
                            className="shrink-0 text-[10px] text-slate-500 hover:text-rose-300"
                          >
                            Tắt tiếng
                          </button>
                        )}
                      </div>
                    ))
                )}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  maxLength={300}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Gửi
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!isHost && currentMember && (
              <button
                type="button"
                onClick={handleToggleReady}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  currentMember.isReady
                    ? 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {currentMember.isReady ? 'Huỷ sẵn sàng' : 'Sẵn sàng'}
              </button>
            )}

            {isHost && (
              <button
                type="button"
                onClick={handleStart}
                className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Bắt đầu trận
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
