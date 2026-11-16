'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  SOCKET_EVENTS,
  getGameCatalogItem,
  type ColorUnoPlayerView,
  type DiceFatePlayerView,
  type HighCardPlayerView,
} from '@boardgame/shared';
import { useApp } from '@/components/AppProvider';
import { TableShell, type TableSeat } from '@/components/TableShell';
import { ColorUnoBoard } from '@/components/games/ColorUnoBoard';
import { DiceFateBoard } from '@/components/games/DiceFateBoard';
import { HighCardBoard } from '@/components/games/HighCardBoard';
import { playSound } from '@/lib/sound';

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = String(params.code ?? '').toUpperCase();
  const { user, loadingAuth, socket, room, setRoom, gameView, turnEndsAt } = useApp();

  // Route guard: /play/[code] before game starts -> redirect to /rooms/[code]
  useEffect(() => {
    if (loadingAuth || !user) return;
    if (room && room.code === code && room.status === 'lobby') {
      router.replace(`/rooms/${code}`);
    } else if (!room && !gameView) {
      router.replace(`/rooms/${code}`);
    }
  }, [loadingAuth, user, room, code, gameView, router]);

  if (loadingAuth || !user || !gameView) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 text-center text-sm text-slate-400">
        Đang tải bàn chơi #{code}...
      </main>
    );
  }

  const isHost = room?.hostId === user.id;

  const handleAction = (action: Record<string, unknown>) => {
    if (!socket) return;
    playSound('card');
    socket.emit(SOCKET_EVENTS.GAME_ACTION, { roomCode: code, action });
  };

  const handleReturnLobby = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.GAME_RETURN_LOBBY, {});
  };

  const handleLeave = () => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.ROOM_LEAVE, {}, () => {
      setRoom(null);
      router.push('/games');
    });
  };

  if (gameView.gameId === 'color-uno') {
    const v = gameView as ColorUnoPlayerView;
    const seats: TableSeat[] = v.players.map((p) => {
      const member = room?.members.find((m) => m.id === p.id);
      return {
        id: p.id,
        username: p.username,
        avatarId: p.avatarId,
        level: p.level ?? 1,
        isCurrentTurn: v.currentTurnPlayerId === p.id,
        cardCount: p.cardCount,
        away: member ? !member.connected : false,
        badge: p.calledLastCard && p.cardCount === 1 ? 'CÒN 1 LÁ!' : undefined,
        sublabel: v.roundsMode === '500' ? `${p.score} điểm` : undefined,
      };
    });

    return (
      <TableShell
        title={getGameCatalogItem('color-uno').name}
        roomCode={code}
        seats={seats}
        myPlayerId={user.id}
        turnEndsAt={turnEndsAt}
        actionLog={v.actionLog}
        isGameOver={v.isGameOver}
        result={v.result}
        isHost={isHost}
        tableThemeClass="bg-[radial-gradient(circle_at_center,#ea580c_0%,#991b1b_55%,#450a0a_100%)]"
        onReturnLobby={handleReturnLobby}
        onLeaveRoom={handleLeave}
      >
        <ColorUnoBoard view={v} onAction={handleAction} />
      </TableShell>
    );
  }

  if (gameView.gameId === 'dice-fate') {
    const v = gameView as DiceFatePlayerView;
    const seats: TableSeat[] = v.players.map((p) => {
      const member = room?.members.find((m) => m.id === p.id);
      return {
        id: p.id,
        username: p.username,
        avatarId: p.avatarId,
        level: p.level ?? 1,
        isCurrentTurn: v.activePlayerId === p.id,
        eliminated: !p.alive,
        away: member ? !member.connected : false,
        badge: v.activePlayerId === p.id ? 'Cầm xúc xắc' : undefined,
        sublabel: !p.alive ? 'Đã bị loại' : p.hasCard ? 'Có 1 thẻ úp' : 'Hết thẻ',
      };
    });

    return (
      <TableShell
        title={getGameCatalogItem('dice-fate').name}
        roomCode={code}
        seats={seats}
        myPlayerId={user.id}
        turnEndsAt={turnEndsAt}
        actionLog={v.actionLog}
        isGameOver={v.isGameOver}
        result={v.result}
        isHost={isHost}
        tableThemeClass="bg-[radial-gradient(circle_at_center,#065f46_0%,#064e3b_55%,#022c22_100%)]"
        onReturnLobby={handleReturnLobby}
        onLeaveRoom={handleLeave}
      >
        <DiceFateBoard view={v} onAction={handleAction} />
      </TableShell>
    );
  }

  // Fallback test game (high-card)
  const hv = gameView as HighCardPlayerView;
  const hSeats: TableSeat[] = hv.players.map((p) => ({
    id: p.id,
    username: p.username,
    avatarId: p.avatarId,
    level: 1,
    isCurrentTurn: hv.currentTurnPlayerId === p.id,
    cardCount: p.cardCount,
  }));

  return (
    <TableShell
      title={getGameCatalogItem('high-card').name}
      roomCode={code}
      seats={hSeats}
      myPlayerId={user.id}
      turnEndsAt={turnEndsAt}
      actionLog={hv.actionLog}
      isGameOver={hv.isGameOver}
      result={hv.result}
      isHost={isHost}
      onReturnLobby={handleReturnLobby}
      onLeaveRoom={handleLeave}
    >
      <HighCardBoard view={hv} onAction={handleAction} />
    </TableShell>
  );
}
