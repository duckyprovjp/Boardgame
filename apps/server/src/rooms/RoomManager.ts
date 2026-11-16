import crypto from 'crypto';
import {
  getGameCatalogItem,
  type CreateRoomInput,
  type GameId,
  type PublicUser,
  type RoomChatMessage,
  type RoomMember,
  type RoomState,
} from '@boardgame/shared';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECONNECT_GRACE_MS = 60_000;
const MAX_CHAT_HISTORY = 50;

export interface RoomActionResult {
  ok: true;
  room: RoomState;
}

export interface RoomActionError {
  ok: false;
  error: string;
}

export type RoomResult = RoomActionResult | RoomActionError;

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private readonly userToRoom = new Map<string, string>();
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly graceMs = RECONNECT_GRACE_MS) {}

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not generate unique room code');
  }

  getRoomByCode(code: string): RoomState | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomForUser(userId: string): RoomState | undefined {
    const code = this.userToRoom.get(userId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  listPublicLobbyRooms(): Array<{
    code: string;
    gameId: GameId;
    memberCount: number;
    maxPlayers: number;
    hostUsername: string;
  }> {
    const list: Array<{
      code: string;
      gameId: GameId;
      memberCount: number;
      maxPlayers: number;
      hostUsername: string;
    }> = [];
    for (const room of this.rooms.values()) {
      if (room.visibility === 'public' && room.status === 'lobby' && room.members.length < room.maxPlayers) {
        const host = room.members.find((m) => m.id === room.hostId);
        list.push({
          code: room.code,
          gameId: room.gameId,
          memberCount: room.members.length,
          maxPlayers: room.maxPlayers,
          hostUsername: host?.username ?? '',
        });
      }
    }
    return list;
  }

  createRoom(host: PublicUser, input: CreateRoomInput): RoomResult {
    if (this.userToRoom.has(host.id)) {
      return { ok: false, error: 'Bạn đang ở trong một phòng khác' };
    }

    const game = getGameCatalogItem(input.gameId);
    const maxPlayers = Math.min(Math.max(input.maxPlayers, game.minPlayers), game.maxPlayers);
    const code = this.generateRoomCode();

    const room: RoomState = {
      code,
      gameId: input.gameId,
      maxPlayers,
      visibility: input.visibility,
      status: 'lobby',
      hostId: host.id,
      members: [
        {
          ...host,
          isReady: true,
          isHost: true,
          connected: true,
        },
      ],
      chat: [],
    };

    this.rooms.set(code, room);
    this.userToRoom.set(host.id, code);
    return { ok: true, room };
  }

  joinRoom(user: PublicUser, rawCode: string): RoomResult {
    const code = rawCode.trim().toUpperCase();
    const existingCode = this.userToRoom.get(user.id);
    if (existingCode && existingCode !== code) {
      return { ok: false, error: 'Bạn đang ở trong một phòng khác' };
    }

    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: 'Không tìm thấy phòng với mã này' };
    }

    const existingMember = room.members.find((m) => m.id === user.id);
    if (existingMember) {
      this.clearDisconnectTimer(user.id);
      existingMember.connected = true;
      return { ok: true, room };
    }

    if (room.status !== 'lobby') {
      return { ok: false, error: 'Phòng đã bắt đầu trận đấu' };
    }

    if (room.members.length >= room.maxPlayers) {
      return { ok: false, error: 'Phòng đã đầy' };
    }

    const member: RoomMember = {
      ...user,
      isReady: false,
      isHost: false,
      connected: true,
    };
    room.members.push(member);
    this.userToRoom.set(user.id, code);
    return { ok: true, room };
  }

  leaveRoom(userId: string): { code: string; room: RoomState | null } | null {
    this.clearDisconnectTimer(userId);
    const code = this.userToRoom.get(userId);
    if (!code) return null;

    this.userToRoom.delete(userId);
    const room = this.rooms.get(code);
    if (!room) return null;

    room.members = room.members.filter((m) => m.id !== userId);

    if (room.members.length === 0) {
      this.rooms.delete(code);
      return { code, room: null };
    }

    if (room.hostId === userId) {
      const nextHost = room.members.find((m) => m.connected) ?? room.members[0]!;
      room.hostId = nextHost.id;
      for (const m of room.members) {
        m.isHost = m.id === nextHost.id;
        if (m.isHost) m.isReady = true;
      }
    }

    return { code, room };
  }

  handleDisconnect(userId: string, onExpire: (code: string, room: RoomState | null) => void): RoomState | null {
    const room = this.getRoomForUser(userId);
    if (!room) return null;

    const member = room.members.find((m) => m.id === userId);
    if (member) {
      member.connected = false;
    }

    this.clearDisconnectTimer(userId);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      const result = this.leaveRoom(userId);
      if (result) {
        onExpire(result.code, result.room);
      }
    }, this.graceMs);
    this.disconnectTimers.set(userId, timer);

    return room;
  }

  handleReconnect(userId: string): RoomState | null {
    this.clearDisconnectTimer(userId);
    const room = this.getRoomForUser(userId);
    if (!room) return null;

    const member = room.members.find((m) => m.id === userId);
    if (member) {
      member.connected = true;
    }
    return room;
  }

  private clearDisconnectTimer(userId: string): void {
    const timer = this.disconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(userId);
    }
  }

  setReady(userId: string, isReady: boolean): RoomResult {
    const room = this.getRoomForUser(userId);
    if (!room) return { ok: false, error: 'Bạn không ở trong phòng nào' };
    if (room.status !== 'lobby') return { ok: false, error: 'Trận đấu đã bắt đầu' };

    const member = room.members.find((m) => m.id === userId);
    if (!member) return { ok: false, error: 'Không tìm thấy thành viên' };

    member.isReady = member.isHost ? true : isReady;
    return { ok: true, room };
  }

  kickMember(hostId: string, targetUserId: string): RoomResult {
    const room = this.getRoomForUser(hostId);
    if (!room) return { ok: false, error: 'Bạn không ở trong phòng nào' };
    if (room.hostId !== hostId) return { ok: false, error: 'Chỉ chủ phòng mới có quyền đuổi' };
    if (hostId === targetUserId) return { ok: false, error: 'Không thể tự đuổi chính mình' };

    const exists = room.members.some((m) => m.id === targetUserId);
    if (!exists) return { ok: false, error: 'Người chơi không ở trong phòng' };

    this.clearDisconnectTimer(targetUserId);
    this.userToRoom.delete(targetUserId);
    room.members = room.members.filter((m) => m.id !== targetUserId);
    return { ok: true, room };
  }

  transferHost(hostId: string, targetUserId: string): RoomResult {
    const room = this.getRoomForUser(hostId);
    if (!room) return { ok: false, error: 'Bạn không ở trong phòng nào' };
    if (room.hostId !== hostId) return { ok: false, error: 'Chỉ chủ phòng mới có quyền chuyển' };

    const target = room.members.find((m) => m.id === targetUserId);
    if (!target) return { ok: false, error: 'Không tìm thấy thành viên trong phòng' };

    room.hostId = target.id;
    for (const m of room.members) {
      m.isHost = m.id === target.id;
      if (m.isHost) m.isReady = true;
    }
    return { ok: true, room };
  }

  addChatMessage(userId: string, text: string): { room: RoomState; message: RoomChatMessage } | null {
    const room = this.getRoomForUser(userId);
    if (!room) return null;

    const member = room.members.find((m) => m.id === userId);
    if (!member) return null;

    const message: RoomChatMessage = {
      id: crypto.randomUUID(),
      senderId: member.id,
      senderUsername: member.username,
      text,
      createdAt: new Date().toISOString(),
    };
    room.chat.push(message);
    if (room.chat.length > MAX_CHAT_HISTORY) {
      room.chat = room.chat.slice(-MAX_CHAT_HISTORY);
    }
    return { room, message };
  }

  startGame(hostId: string): RoomResult {
    const room = this.getRoomForUser(hostId);
    if (!room) return { ok: false, error: 'Bạn không ở trong phòng nào' };
    if (room.hostId !== hostId) return { ok: false, error: 'Chỉ chủ phòng mới có thể bắt đầu' };
    if (room.status !== 'lobby') return { ok: false, error: 'Trận đấu đã bắt đầu' };

    const game = getGameCatalogItem(room.gameId);
    if (room.members.length < game.minPlayers) {
      return { ok: false, error: `Cần ít nhất ${game.minPlayers} người chơi để bắt đầu` };
    }

    const notReady = room.members.find((m) => !m.isHost && !m.isReady);
    if (notReady) {
      return { ok: false, error: `${notReady.username} chưa sẵn sàng` };
    }

    room.status = 'starting';
    return { ok: true, room };
  }

  returnToLobby(hostId: string): RoomResult {
    const room = this.getRoomForUser(hostId);
    if (!room) return { ok: false, error: 'Bạn không ở trong phòng nào' };
    if (room.hostId !== hostId) return { ok: false, error: 'Chỉ chủ phòng mới có thể quay lại sảnh' };

    room.status = 'lobby';
    for (const m of room.members) {
      m.isReady = m.isHost;
    }
    return { ok: true, room };
  }

  createMatchedRoom(players: Array<PublicUser & { isBot?: boolean }>, gameId: GameId): RoomState {
    const code = this.generateRoomCode();
    const host = players[0]!;
    const members: RoomMember[] = players.map((p, idx) => ({
      ...p,
      isReady: true,
      isHost: idx === 0,
      connected: true,
    }));

    const room: RoomState = {
      code,
      gameId,
      maxPlayers: players.length,
      visibility: 'private',
      status: 'in_game',
      hostId: host.id,
      members,
      chat: [],
    };

    this.rooms.set(code, room);
    for (const m of members) {
      if (!m.isBot) {
        this.userToRoom.set(m.id, code);
      }
    }
    return room;
  }
}
