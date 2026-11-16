import { Router } from 'express';
import type { Server } from 'socket.io';
import { AdminBanSchema, ReportPlayerSchema } from '@boardgame/shared';
import { requireAuth, type AuthenticatedRequest } from '../auth';
import { prisma } from '../db';

export function createSafetyRouter(io: Server): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/report', async (req: AuthenticatedRequest, res) => {
    const reporterId = req.user!.id;
    const parsed = ReportPlayerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
      return;
    }

    if (parsed.data.targetUserId === reporterId) {
      res.status(400).json({ error: 'Không thể tự báo cáo chính mình' });
      return;
    }

    await prisma.playerReport.create({
      data: {
        reporterId,
        targetId: parsed.data.targetUserId,
        reason: parsed.data.reason,
      },
    });

    res.status(201).json({ ok: true });
  });

  router.post('/admin/ban', async (req: AuthenticatedRequest, res) => {
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isAdmin: true },
    });
    if (!actor?.isAdmin) {
      res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền khoá tài khoản' });
      return;
    }

    const parsed = AdminBanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: parsed.data.targetUserId },
        data: { isBanned: parsed.data.banned },
      }),
      ...(parsed.data.banned
        ? [prisma.session.deleteMany({ where: { userId: parsed.data.targetUserId } })]
        : []),
    ]);

    if (parsed.data.banned) {
      io.in(`user:${parsed.data.targetUserId}`).disconnectSockets(true);
    }

    res.json({ ok: true });
  });

  return router;
}
