import { Router } from 'express';
import {
  GameIdSchema,
  type LeaderboardEntry,
  type MatchHistoryEntry,
  type UserGameStats,
} from '@boardgame/shared';
import { requireAuth, type AuthenticatedRequest } from '../auth';
import { prisma } from '../db';
import { getFriendIds } from './friends';

export const progressionRouter = Router();
progressionRouter.use(requireAuth);

progressionRouter.get('/me', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const [statsRows, recentMatches] = await Promise.all([
    prisma.userStats.findMany({ where: { userId } }),
    prisma.matchRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  const stats: UserGameStats[] = statsRows.map((s) => ({
    gameId: s.gameId as UserGameStats['gameId'],
    wins: s.wins,
    losses: s.losses,
    elo: s.elo,
  }));

  const history: MatchHistoryEntry[] = [];
  for (const m of recentMatches) {
    const rankings = m.rankings as Array<{ playerId: string; rank: number }>;
    const myEntry = rankings.find((r) => r.playerId === userId);
    if (myEntry) {
      history.push({
        id: m.id,
        gameId: m.gameId,
        roomCode: m.roomCode,
        won: m.winnerIds.includes(userId),
        rank: myEntry.rank,
        createdAt: m.createdAt.toISOString(),
      });
    }
  }

  res.json({ stats, history: history.slice(0, 15) });
});

progressionRouter.get('/leaderboard', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const parsedGame = GameIdSchema.safeParse(req.query.gameId ?? 'color-uno');
  const gameId = parsedGame.success ? parsedGame.data : 'color-uno';
  const scope = req.query.scope === 'friends' ? 'friends' : 'global';

  let userFilter: string[] | undefined;
  if (scope === 'friends') {
    const friendIds = await getFriendIds(userId);
    userFilter = [userId, ...friendIds];
  }

  const rows = await prisma.userStats.findMany({
    where: {
      gameId,
      ...(userFilter ? { userId: { in: userFilter } } : {}),
      user: { isBanned: false },
    },
    include: {
      user: { select: { id: true, username: true, avatarId: true } },
    },
    orderBy: [{ elo: 'desc' }, { wins: 'desc' }],
    take: 20,
  });

  const entries: LeaderboardEntry[] = rows.map((r) => ({
    userId: r.user.id,
    username: r.user.username,
    avatarId: r.user.avatarId,
    elo: r.elo,
    wins: r.wins,
    losses: r.losses,
  }));

  res.json({ gameId, scope, entries });
});
