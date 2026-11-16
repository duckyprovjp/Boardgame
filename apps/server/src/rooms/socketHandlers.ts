import type { Server, Socket } from 'socket.io';
import {
  CreateRoomSchema,
  GameActionPayloadSchema,
  JoinRoomSchema,
  QueueJoinSchema,
  RoomChatSchema,
  RoomInviteSchema,
  RoomKickSchema,
  RoomReadySchema,
  RoomTransferHostSchema,
  SOCKET_EVENTS,
  type AuthUser,
  type MatchStatusPayload,
  type PublicUser,
  type RoomInvitePayload,
  type RoomState,
} from '@boardgame/shared';
import type { GameManager } from '../games/GameManager';
import { getGameModule } from '../games/registry';
import type { MatchmakingService } from '../matchmaking/MatchmakingService';
import { recordMatchStats } from '../progression/elo';
import { sanitizeChatText } from '../sanitize';
import type { RoomManager } from './RoomManager';

type AckFn = (res: { ok: boolean; error?: string; room?: RoomState }) => void;

function safeAck(ack: unknown, res: { ok: boolean; error?: string; room?: RoomState }) {
  if (typeof ack === 'function') {
    (ack as AckFn)(res);
  }
}

export function registerRoomHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  gameManager: GameManager,
  matchmaking: MatchmakingService,
) {
  const user = socket.data.user as AuthUser;
  let lastActionAt = 0;
  let lastChatAt = 0;

  const allowAction = (ack?: unknown): boolean => {
    const now = Date.now();
    if (now - lastActionAt < 100) {
      safeAck(ack, { ok: false, error: 'Thao tác quá nhanh' });
      return false;
    }
    lastActionAt = now;
    return true;
  };

  // Rejoin existing room if reconnecting within grace period
  const rejoinedRoom = roomManager.handleReconnect(user.id);
  if (rejoinedRoom) {
    socket.join(`room:${rejoinedRoom.code}`);
    io.to(`room:${rejoinedRoom.code}`).emit(SOCKET_EVENTS.ROOM_STATE, rejoinedRoom);

    if (rejoinedRoom.status === 'in_game') {
      const currentView = gameManager.getPlayerView(rejoinedRoom.code, user.id);
      if (currentView) {
        socket.emit(SOCKET_EVENTS.GAME_STATE, currentView);
      }
    }
  }

  socket.on(SOCKET_EVENTS.ROOM_CREATE, (rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const parsed = CreateRoomSchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
      return;
    }

    const result = roomManager.createRoom(user, parsed.data);
    if (!result.ok) {
      safeAck(ack, result);
      return;
    }

    socket.join(`room:${result.room.code}`);
    safeAck(ack, { ok: true, room: result.room });
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
  });

  socket.on(SOCKET_EVENTS.ROOM_JOIN, (rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const parsed = JoinRoomSchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: parsed.error.issues[0]?.message ?? 'Mã phòng không hợp lệ' });
      return;
    }

    const result = roomManager.joinRoom(user, parsed.data.code);
    if (!result.ok) {
      safeAck(ack, result);
      return;
    }

    socket.join(`room:${result.room.code}`);
    safeAck(ack, { ok: true, room: result.room });
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
  });

  socket.on(SOCKET_EVENTS.ROOM_LEAVE, (_rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const result = roomManager.leaveRoom(user.id);
    if (!result) {
      safeAck(ack, { ok: false, error: 'Bạn không ở trong phòng nào' });
      return;
    }

    socket.leave(`room:${result.code}`);
    safeAck(ack, { ok: true });
    if (result.room) {
      io.to(`room:${result.code}`).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    } else {
      gameManager.cleanupGame(result.code);
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_READY, (rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const parsed = RoomReadySchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: 'Dữ liệu không hợp lệ' });
      return;
    }

    const result = roomManager.setReady(user.id, parsed.data.isReady);
    if (!result.ok) {
      safeAck(ack, result);
      return;
    }

    safeAck(ack, { ok: true, room: result.room });
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
  });

  socket.on(SOCKET_EVENTS.ROOM_KICK, (rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const parsed = RoomKickSchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: 'Dữ liệu không hợp lệ' });
      return;
    }

    const result = roomManager.kickMember(user.id, parsed.data.targetUserId);
    if (!result.ok) {
      safeAck(ack, result);
      return;
    }

    safeAck(ack, { ok: true, room: result.room });
    io.to(`user:${parsed.data.targetUserId}`).emit(SOCKET_EVENTS.ROOM_KICKED, {
      code: result.room.code,
      reason: 'Bạn đã bị chủ phòng mời ra khỏi phòng',
    });
    io.in(`user:${parsed.data.targetUserId}`).socketsLeave(`room:${result.room.code}`);
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
  });

  socket.on(SOCKET_EVENTS.ROOM_TRANSFER_HOST, (rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const parsed = RoomTransferHostSchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: 'Dữ liệu không hợp lệ' });
      return;
    }

    const result = roomManager.transferHost(user.id, parsed.data.targetUserId);
    if (!result.ok) {
      safeAck(ack, result);
      return;
    }

    safeAck(ack, { ok: true, room: result.room });
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
  });

  socket.on(SOCKET_EVENTS.ROOM_INVITE, (rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const parsed = RoomInviteSchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: 'Dữ liệu mời không hợp lệ' });
      return;
    }

    const room = roomManager.getRoomForUser(user.id);
    if (!room || room.code !== parsed.data.roomCode) {
      safeAck(ack, { ok: false, error: 'Bạn không ở trong phòng này' });
      return;
    }

    const invite: RoomInvitePayload = {
      roomCode: room.code,
      gameId: room.gameId,
      fromUser: {
        id: user.id,
        username: user.username,
        avatarId: user.avatarId,
        isGuest: user.isGuest,
      },
    };
    io.to(`user:${parsed.data.targetUserId}`).emit(SOCKET_EVENTS.ROOM_INVITE_RECEIVED, invite);
    safeAck(ack, { ok: true });
  });

  socket.on(SOCKET_EVENTS.ROOM_CHAT_SEND, (rawPayload: unknown, ack: unknown) => {
    const now = Date.now();
    if (now - lastChatAt < 350) {
      safeAck(ack, { ok: false, error: 'Bạn gửi tin nhắn quá nhanh' });
      return;
    }
    lastChatAt = now;

    const parsed = RoomChatSchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: parsed.error.issues[0]?.message ?? 'Tin nhắn không hợp lệ' });
      return;
    }

    const cleanText = sanitizeChatText(parsed.data.text);
    if (!cleanText) {
      safeAck(ack, { ok: false, error: 'Tin nhắn không hợp lệ' });
      return;
    }

    const result = roomManager.addChatMessage(user.id, cleanText);
    if (!result) {
      safeAck(ack, { ok: false, error: 'Bạn không ở trong phòng nào' });
      return;
    }

    safeAck(ack, { ok: true });
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_CHAT_MESSAGE, result.message);
  });

  socket.on(SOCKET_EVENTS.ROOM_START, (_rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const result = roomManager.startGame(user.id);
    if (!result.ok) {
      safeAck(ack, result);
      return;
    }

    const gameModule = getGameModule(result.room.gameId);
    if (gameModule) {
      result.room.status = 'in_game';
    }

    safeAck(ack, { ok: true, room: result.room });
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_STARTING, {
      code: result.room.code,
      gameId: result.room.gameId,
    });

    if (gameModule) {
      gameManager.startGame(result.room, gameModule, {
        onPlayerView: (playerId, view, turnEndsAt) => {
          io.to(`user:${playerId}`).emit(SOCKET_EVENTS.GAME_STATE, { view, turnEndsAt });
        },
        onGameOver: (roomCode, gameId, gameResult) => {
          io.to(`room:${roomCode}`).emit(SOCKET_EVENTS.GAME_OVER, gameResult);
          void recordMatchStats(roomCode, gameId, gameResult).catch((err) =>
            console.error('Failed to persist match stats:', err),
          );
        },
      });
    }
  });

  socket.on(SOCKET_EVENTS.GAME_ACTION, (rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const parsed = GameActionPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: 'Hành động không hợp lệ' });
      return;
    }

    const room = roomManager.getRoomForUser(user.id);
    if (!room || room.code !== parsed.data.roomCode) {
      safeAck(ack, { ok: false, error: 'Bạn không ở trong phòng này' });
      return;
    }

    const actionResult = gameManager.applyAction(room.code, user.id, parsed.data.action);
    safeAck(ack, actionResult);
  });

  socket.on(SOCKET_EVENTS.GAME_RETURN_LOBBY, (_rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const result = roomManager.returnToLobby(user.id);
    if (!result.ok) {
      safeAck(ack, result);
      return;
    }
    gameManager.cleanupGame(result.room.code);
    safeAck(ack, { ok: true, room: result.room });
    io.to(`room:${result.room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
  });

  const launchMatch = (players: Array<PublicUser & { isBot?: boolean }>, gameId: RoomState['gameId']) => {
    const room = roomManager.createMatchedRoom(players, gameId);
    for (const m of room.members) {
      if (!m.isBot) {
        io.in(`user:${m.id}`).socketsJoin(`room:${room.code}`);
        io.to(`user:${m.id}`).emit(SOCKET_EVENTS.MATCH_FOUND, { room });
        io.to(`user:${m.id}`).emit(SOCKET_EVENTS.MATCH_STATUS, {
          status: 'matched',
          gameId,
          roomCode: room.code,
        } satisfies MatchStatusPayload);
      }
    }
    io.to(`room:${room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, room);

    const gameModule = getGameModule(gameId);
    if (gameModule) {
      gameManager.startGame(room, gameModule, {
        onPlayerView: (playerId, view, turnEndsAt) => {
          io.to(`user:${playerId}`).emit(SOCKET_EVENTS.GAME_STATE, { view, turnEndsAt });
        },
        onGameOver: (roomCode, gId, gameResult) => {
          io.to(`room:${roomCode}`).emit(SOCKET_EVENTS.GAME_OVER, gameResult);
          void recordMatchStats(roomCode, gId, gameResult).catch((err) =>
            console.error('Failed to persist match stats:', err),
          );
        },
      });
    }
  };

  const matchHooks = {
    onStatus: (targetId: string, status: MatchStatusPayload) => {
      io.to(`user:${targetId}`).emit(SOCKET_EVENTS.MATCH_STATUS, status);
    },
    onMatched: launchMatch,
  };

  socket.on(SOCKET_EVENTS.MATCH_JOIN_QUEUE, async (rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    if (roomManager.getRoomForUser(user.id)) {
      safeAck(ack, { ok: false, error: 'Bạn đang ở trong một phòng khác' });
      return;
    }
    const parsed = QueueJoinSchema.safeParse(rawPayload);
    if (!parsed.success) {
      safeAck(ack, { ok: false, error: 'Dữ liệu tìm trận không hợp lệ' });
      return;
    }
    const res = await matchmaking.joinQueue(user, parsed.data, matchHooks);
    safeAck(ack, res);
  });

  socket.on(SOCKET_EVENTS.MATCH_CANCEL_QUEUE, async (_rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    await matchmaking.cancelQueue(user.id, matchHooks);
    safeAck(ack, { ok: true });
  });

  socket.on(SOCKET_EVENTS.MATCH_FILL_BOTS, async (_rawPayload: unknown, ack: unknown) => {
    if (!allowAction(ack)) return;
    const res = await matchmaking.fillWithBots(user.id, matchHooks);
    safeAck(ack, res);
  });

  socket.on('disconnect', () => {
    void matchmaking.cancelQueue(user.id);
    const room = roomManager.handleDisconnect(user.id, (code, updatedRoom) => {
      if (updatedRoom) {
        io.to(`room:${code}`).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
      } else {
        gameManager.cleanupGame(code);
      }
    });
    if (room) {
      io.to(`room:${room.code}`).emit(SOCKET_EVENTS.ROOM_STATE, room);
    }
  });
}
