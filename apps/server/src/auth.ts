import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '@boardgame/shared';
import { prisma } from './db';

export const SESSION_COOKIE_NAME = 'bg_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

function getSessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || 'dev-session-secret-change-in-production';
}

function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(rawToken).digest('hex');
}

export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

export async function createSession(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return rawToken;
}

export async function getUserFromSessionToken(rawToken: string): Promise<AuthUser | null> {
  if (!rawToken) return null;
  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.user.isBanned) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    avatarId: session.user.avatarId,
    isGuest: session.user.isGuest,
    email: session.user.email,
  };
}

export async function deleteSessionByToken(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export function setSessionCookie(res: Response, rawToken: string): void {
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    ...getSessionCookieOptions(),
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
}

function getSocketSigningKey(): string {
  return process.env.SOCKET_TOKEN_SECRET || process.env.DATABASE_URL || 'dev-socket-secret';
}

export function signSocketToken(userId: string): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const payload = `${userId}.${exp}`;
  const sig = crypto.createHmac('sha256', getSocketSigningKey()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySocketToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts as [string, string, string];
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || exp <= Date.now()) return null;
  const expected = crypto
    .createHmac('sha256', getSocketSigningKey())
    .update(`${userId}.${expStr}`)
    .digest('hex');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return userId;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token !== 'string' || !token) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return;
  }

  const user = await getUserFromSessionToken(token);
  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' });
    return;
  }

  req.user = user;
  next();
}
