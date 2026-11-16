import type { GameModule, GamePlayer, GameResult, RoomState } from '@boardgame/shared';

export interface GameBroadcastHooks {
  onPlayerView: (playerId: string, view: unknown, turnEndsAt: number | null) => void;
  onGameOver: (roomCode: string, gameId: string, result: GameResult) => void;
}

interface ActiveGameSession {
  roomCode: string;
  gameId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  module: GameModule<any, any, any, any>;
  state: unknown;
  players: GamePlayer[];
  turnTimer: NodeJS.Timeout | null;
  turnEndsAt: number | null;
  hooks: GameBroadcastHooks;
}

const DEFAULT_TURN_DURATION_MS = 30_000;

function matchesAction(legal: unknown, candidate: unknown): boolean {
  if (typeof legal !== 'object' || legal === null || typeof candidate !== 'object' || candidate === null) {
    return legal === candidate;
  }
  const lRec = legal as Record<string, unknown>;
  const cRec = candidate as Record<string, unknown>;
  const lKeys = Object.keys(lRec);
  const cKeys = Object.keys(cRec);
  if (lKeys.length !== cKeys.length) return false;
  return lKeys.every((k) => lRec[k] === cRec[k]);
}

export class GameManager {
  private readonly sessions = new Map<string, ActiveGameSession>();

  constructor(private readonly turnDurationMs = DEFAULT_TURN_DURATION_MS) {}

  hasGame(roomCode: string): boolean {
    return this.sessions.has(roomCode);
  }

  startGame(
    room: RoomState,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    module: GameModule<any, any, any, any>,
    hooks: GameBroadcastHooks,
  ): void {
    this.cleanupGame(room.code);

    const players: GamePlayer[] = room.members.map((m) => ({
      id: m.id,
      username: m.username,
      avatarId: m.avatarId,
      level: m.level ?? 1,
      isBot: m.isBot,
    }));

    const state = module.setup(players, room.options);
    const session: ActiveGameSession = {
      roomCode: room.code,
      gameId: room.gameId,
      module,
      state,
      players,
      turnTimer: null,
      turnEndsAt: null,
      hooks,
    };

    this.sessions.set(room.code, session);
    this.scheduleTurnTimer(session);
    this.broadcastViews(session);
  }

  applyAction(
    roomCode: string,
    playerId: string,
    rawAction: Record<string, unknown>,
  ): { ok: true } | { ok: false; error: string } {
    const session = this.sessions.get(roomCode);
    if (!session) {
      return { ok: false, error: 'Không tìm thấy trận đấu đang diễn ra' };
    }

    if (session.module.isGameOver(session.state)) {
      return { ok: false, error: 'Trận đấu đã kết thúc' };
    }

    const legalActions = session.module.getLegalActions(session.state, playerId);
    const matched = legalActions.find((a) => matchesAction(a, rawAction));
    if (!matched) {
      return { ok: false, error: 'Hành động không hợp lệ hoặc chưa tới lượt bạn' };
    }

    session.state = session.module.applyAction(session.state, playerId, matched);
    this.clearTurnTimer(session);

    if (session.module.isGameOver(session.state)) {
      session.turnEndsAt = null;
      this.broadcastViews(session);
      const result = session.module.getResult(session.state);
      session.hooks.onGameOver(session.roomCode, session.gameId, result);
      return { ok: true };
    }

    this.scheduleTurnTimer(session);
    this.broadcastViews(session);
    return { ok: true };
  }

  getPlayerView(
    roomCode: string,
    playerId: string,
  ): { view: unknown; turnEndsAt: number | null } | null {
    const session = this.sessions.get(roomCode);
    if (!session) return null;
    return {
      view: session.module.getPlayerView(session.state, playerId),
      turnEndsAt: session.turnEndsAt,
    };
  }

  cleanupGame(roomCode: string): void {
    const session = this.sessions.get(roomCode);
    if (!session) return;
    this.clearTurnTimer(session);
    this.sessions.delete(roomCode);
  }

  private broadcastViews(session: ActiveGameSession): void {
    for (const p of session.players) {
      const view = session.module.getPlayerView(session.state, p.id);
      session.hooks.onPlayerView(p.id, view, session.turnEndsAt);
    }
  }

  private clearTurnTimer(session: ActiveGameSession): void {
    if (session.turnTimer) {
      clearTimeout(session.turnTimer);
      session.turnTimer = null;
    }
  }

  private scheduleTurnTimer(session: ActiveGameSession): void {
    this.clearTurnTimer(session);
    if (session.module.isGameOver(session.state)) {
      session.turnEndsAt = null;
      return;
    }

    session.turnEndsAt = Date.now() + this.turnDurationMs;

    // Check if current turn belongs to a bot -> act quickly
    const firstPlayer = session.players[0];
    let delayMs = this.turnDurationMs;
    if (firstPlayer) {
      const sampleView = session.module.getPlayerView(session.state, firstPlayer.id) as {
        currentTurnPlayerId?: string | null;
      };
      const turnPlayer = session.players.find((p) => p.id === sampleView?.currentTurnPlayerId);
      if (turnPlayer?.isBot) {
        delayMs = 450;
      }
    }

    session.turnTimer = setTimeout(() => {
      this.handleTurnTimeout(session.roomCode);
    }, delayMs);
  }

  private handleTurnTimeout(roomCode: string): void {
    const session = this.sessions.get(roomCode);
    if (!session || session.module.isGameOver(session.state)) return;

    const firstPlayer = session.players[0];
    if (firstPlayer) {
      const sampleView = session.module.getPlayerView(session.state, firstPlayer.id) as {
        currentTurnPlayerId?: string | null;
      };
      if (sampleView?.currentTurnPlayerId) {
        const legal = session.module.getLegalActions(
          session.state,
          sampleView.currentTurnPlayerId,
        );
        if (legal.length > 0) {
          const autoAction = legal[0] as Record<string, unknown>;
          this.applyAction(roomCode, sampleView.currentTurnPlayerId, autoAction);
          return;
        }
      }
    }

    // Fallback: pick first player with a legal action
    for (const p of session.players) {
      const legal = session.module.getLegalActions(session.state, p.id);
      if (legal.length > 0) {
        const autoAction = legal[0] as Record<string, unknown>;
        this.applyAction(roomCode, p.id, autoAction);
        return;
      }
    }
  }
}
