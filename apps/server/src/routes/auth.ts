import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  GuestLoginSchema,
  LoginSchema,
  RegisterSchema,
  type AuthUser,
} from '@boardgame/shared';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSession,
  deleteSessionByToken,
  getUserFromSessionToken,
  setSessionCookie,
} from '../auth';
import { prisma } from '../db';
import { containsProfanity } from '../safety/profanity';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút' },
});

function toAuthUser(user: {
  id: string;
  username: string;
  avatarId: string;
  isGuest: boolean;
  email: string | null;
}): AuthUser {
  return {
    id: user.id,
    username: user.username,
    avatarId: user.avatarId,
    isGuest: user.isGuest,
    email: user.email,
  };
}

authRouter.post('/register', authLimiter, async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Dữ liệu đăng ký không hợp lệ',
    });
    return;
  }

  const { email, password, username, avatarId } = parsed.data;
  if (containsProfanity(username)) {
    res.status(400).json({ error: 'Tên người dùng chứa từ ngữ không phù hợp' });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
    select: { email: true, username: true },
  });

  if (existing) {
    const message =
      existing.email === email ? 'Email đã được sử dụng' : 'Tên người dùng đã tồn tại';
    res.status(409).json({ error: message });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      username,
      avatarId,
      isGuest: false,
    },
  });

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: toAuthUser(user) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Dữ liệu đăng nhập không hợp lệ',
    });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    return;
  }
  if (user.isBanned) {
    res.status(403).json({ error: 'Tài khoản đã bị khoá' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    return;
  }

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: toAuthUser(user) });
});

authRouter.post('/guest', authLimiter, async (req, res) => {
  const parsed = GuestLoginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Tên khách không hợp lệ',
    });
    return;
  }

  let username = parsed.data.username;
  if (username) {
    if (containsProfanity(username)) {
      res.status(400).json({ error: 'Tên người dùng chứa từ ngữ không phù hợp' });
      return;
    }
    const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (taken) {
      res.status(409).json({ error: 'Tên người dùng đã tồn tại' });
      return;
    }
  } else {
    username = `Khach_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  const user = await prisma.user.create({
    data: {
      username,
      avatarId: parsed.data.avatarId,
      isGuest: true,
    },
  });

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: toAuthUser(user) });
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token === 'string' && token) {
    await deleteSessionByToken(token);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token !== 'string' || !token) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return;
  }

  const user = await getUserFromSessionToken(token);
  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ' });
    return;
  }

  res.json({ user });
});
