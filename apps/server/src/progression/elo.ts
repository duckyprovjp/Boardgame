import type { GameResult } from '@boardgame/shared';
import { prisma } from '../db';

const K_FACTOR = 32;
const MIN_ELO = 100;

/**
 * Computes new ELO ratings for a multiplayer match using pairwise expected scores.
 */
export function calculateMultiplayerElo(
  rankings: GameResult['rankings'],
  currentElos: Record<string, number>,
): Record<string, number> {
  const n = rankings.length;
  if (n < 2) return { ...currentElos };

  const updated: Record<string, number> = {};
  for (const p of rankings) {
    const myElo = currentElos[p.playerId] ?? 1000;
    let delta = 0;

    for (const opp of rankings) {
      if (opp.playerId === p.playerId) continue;
      const oppElo = currentElos[opp.playerId] ?? 1000;
      const expected = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
      const actual = p.rank < opp.rank ? 1 : p.rank > opp.rank ? 0 : 0.5;
      delta += (K_FACTOR / (n - 1)) * (actual - expected);
    }

    updated[p.playerId] = Math.max(MIN_ELO, Math.round(myElo + delta));
  }

  return updated;
}

export async function recordMatchStats(
  roomCode: string,
  gameId: string,
  result: GameResult,
): Promise<void> {
  await prisma.matchRecord.create({
    data: {
      roomCode,
      gameId,
      winnerIds: result.winnerIds,
      rankings: result.rankings,
    },
  });

  // Filter out synthetic bot IDs
  const humanRankings = result.rankings.filter((r) => !r.playerId.startsWith('bot_'));
  if (humanRankings.length === 0) return;

  const existingRows = await prisma.userStats.findMany({
    where: {
      gameId,
      userId: { in: humanRankings.map((r) => r.playerId) },
    },
  });

  const eloMap: Record<string, number> = {};
  for (const r of humanRankings) {
    const row = existingRows.find((e) => e.userId === r.playerId);
    eloMap[r.playerId] = row?.elo ?? 1000;
  }

  const newElos = calculateMultiplayerElo(humanRankings, eloMap);

  for (const r of humanRankings) {
    const won = result.winnerIds.includes(r.playerId);
    const nextElo = newElos[r.playerId] ?? 1000;
    await prisma.userStats.upsert({
      where: { userId_gameId: { userId: r.playerId, gameId } },
      update: {
        wins: won ? { increment: 1 } : undefined,
        losses: !won ? { increment: 1 } : undefined,
        elo: nextElo,
      },
      create: {
        userId: r.playerId,
        gameId,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        elo: nextElo,
      },
    });

    // Award XP & update level (no currency/chips)
    const xpGain = won ? 50 : 20;
    const u = await prisma.user.findUnique({
      where: { id: r.playerId },
      select: { xp: true },
    });
    if (u) {
      const nextXp = u.xp + xpGain;
      const nextLevel = Math.floor(nextXp / 100) + 1;
      await prisma.user.update({
        where: { id: r.playerId },
        data: { xp: nextXp, level: nextLevel },
      });
    }
  }
}
