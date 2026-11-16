import {
  BlackjackGame,
  ColorUnoGame,
  DiceFateGame,
  HighCardGame,
  MeoNoGame,
  PokerGame,
  type GameId,
  type GameModule,
} from '@boardgame/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GAME_REGISTRY: Partial<Record<GameId, GameModule<any, any, any, any>>> = {
  'high-card': HighCardGame,
  'color-uno': ColorUnoGame,
  'meo-no': MeoNoGame,
  'dice-fate': DiceFateGame,
  poker: PokerGame,
  blackjack: BlackjackGame,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGameModule(gameId: GameId): GameModule<any, any, any, any> | undefined {
  return GAME_REGISTRY[gameId];
}
