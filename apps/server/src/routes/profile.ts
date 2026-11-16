import { Router } from 'express';
import { UpdateProfileSchema } from '@boardgame/shared';
import { requireAuth, type AuthenticatedRequest } from '../auth';
import { prisma } from '../db';
import { containsProfanity } from '../safety/profanity';

export const profileRouter = Router();

profileRouter.patch('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const currentUser = req.user;
  if (!currentUser) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return;
  }

  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Thông tin hồ sơ không hợp lệ',
    });
    return;
  }

  const { username, avatarId } = parsed.data;
  if (containsProfanity(username)) {
    res.status(400).json({ error: 'Tên người dùng chứa từ ngữ không phù hợp' });
    return;
  }

  if (username !== currentUser.username) {
    const taken = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (taken && taken.id !== currentUser.id) {
      res.status(409).json({ error: 'Tên người dùng đã tồn tại' });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id: currentUser.id },
    data: { username, avatarId },
  });

  res.json({
    user: {
      id: updated.id,
      username: updated.username,
      avatarId: updated.avatarId,
      isGuest: updated.isGuest,
      email: updated.email,
    },
  });
});
