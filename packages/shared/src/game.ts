import { z } from 'zod';

/**
 * Core player descriptor passed into game engine setup.
 */
export interface GamePlayer {
  id: string;
  username: string;
  avatarId: string;
  isBot?: boolean;
}

/**
 * Standard game result returned when a match finishes.
 */
export interface GameResult {
  winnerIds: string[];
  rankings: Array<{
    playerId: string;
    rank: number;
    score?: number;
  }>;
  summary?: string;
}

export interface GameActionLogEntry {
  id: string;
  text: string;
  timestamp: number;
}

export const GameActionPayloadSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6),
  action: z.record(z.unknown()),
});

/**
 * Pure, server-authoritative game engine contract.
 * All game modules MUST implement this interface with no side effects or I/O.
 */
export interface GameModule<
  TState = unknown,
  TAction = unknown,
  TView = unknown,
  TOptions = Record<string, unknown>,
> {
  readonly id: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  setup(players: GamePlayer[], options?: TOptions): TState;
  getLegalActions(state: TState, playerId: string): TAction[];
  applyAction(state: TState, playerId: string, action: TAction): TState;
  getPlayerView(state: TState, playerId: string): TView;
  isGameOver(state: TState): boolean;
  getResult(state: TState): GameResult;
}
