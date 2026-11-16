import http from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import {
  PingPayloadSchema,
  PongPayloadSchema,
  SOCKET_EVENTS,
  type AuthUser,
} from '@boardgame/shared';
import {
  SESSION_COOKIE_NAME,
  getUserFromSessionToken,
  parseCookieHeader,
  verifySocketToken,
} from './auth';
import { prisma } from './db';
import { env } from './env';
import { PresenceTracker } from './presence';
import { GameManager } from './games/GameManager';
import { MatchmakingService } from './matchmaking/MatchmakingService';
import { RoomManager } from './rooms/RoomManager';
import { registerRoomHandlers } from './rooms/socketHandlers';
import { authRouter } from './routes/auth';
import { createFriendsRouter, getFriendIds } from './routes/friends';
import { profileRouter } from './routes/profile';
import { progressionRouter } from './routes/progression';
import { createSafetyRouter } from './routes/safety';

const app = express();
const server = http.createServer(app);

// Trust Render / reverse proxy headers (X-Forwarded-For, X-Forwarded-Proto) for rate limiting and secure cookies.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
  }),
);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(apiLimiter);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'boardgame-server',
    timestamp: Date.now(),
  });
});

app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      database: 'connected',
      timestamp: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    res.status(503).json({
      ok: false,
      database: 'disconnected',
      error: message,
    });
  }
});

// Single-instance Socket.io server.
// When scaling horizontally beyond 1 instance, attach @socket.io/redis-adapter here using REDIS_URL
// (e.g. io.adapter(createAdapter(pubClient, subClient))) and enable sticky sessions at the load balancer.
const io = new Server(server, {
  cors: {
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

const presenceTracker = new PresenceTracker();
const roomManager = new RoomManager();
const gameManager = new GameManager();
const matchmakingService = new MatchmakingService(env.REDIS_URL);

app.get('/api/rooms/public', (_req, res) => {
  res.json({ rooms: roomManager.listPublicLobbyRooms() });
});

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/friends', createFriendsRouter(io, presenceTracker));
app.use('/api/progression', progressionRouter);
app.use('/api/safety', createSafetyRouter(io));

io.use(async (socket, next) => {
  try {
    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) {
      const user = await getUserFromSessionToken(token);
      if (user) {
        socket.data.user = user;
        next();
        return;
      }
    }

    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) {
      const userId = verifySocketToken(authToken);
      if (userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            avatarId: true,
            isGuest: true,
            xp: true,
            level: true,
            email: true,
            isBanned: true,
          },
        });
        if (dbUser && !dbUser.isBanned) {
          socket.data.user = {
            id: dbUser.id,
            username: dbUser.username,
            avatarId: dbUser.avatarId,
            isGuest: dbUser.isGuest,
            xp: dbUser.xp,
            level: dbUser.level,
            email: dbUser.email,
          };
          next();
          return;
        }
      }
    }

    next(new Error('UNAUTHORIZED'));
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
});

const PING_COOLDOWN_MS = 200;

async function notifyFriendsPresence(userId: string) {
  const status = presenceTracker.getStatus(userId);
  const friendIds = await getFriendIds(userId);
  for (const friendId of friendIds) {
    io.to(`user:${friendId}`).emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, status });
  }
}

io.on('connection', (socket) => {
  const user = socket.data.user as AuthUser;
  socket.join(`user:${user.id}`);

  if (presenceTracker.addSocket(user.id, socket.id)) {
    void notifyFriendsPresence(user.id);
  }

  socket.emit(SOCKET_EVENTS.AUTH_READY, {
    id: user.id,
    username: user.username,
    avatarId: user.avatarId,
    isGuest: user.isGuest,
    xp: user.xp,
    level: user.level,
  });

  registerRoomHandlers(io, socket, roomManager, gameManager, matchmakingService);

  socket.on('disconnect', () => {
    if (presenceTracker.removeSocket(user.id, socket.id)) {
      void notifyFriendsPresence(user.id);
    }
  });

  let lastPingAt = 0;

  socket.on(SOCKET_EVENTS.PING, (rawPayload: unknown) => {
    const now = Date.now();
    if (now - lastPingAt < PING_COOLDOWN_MS) {
      return;
    }
    lastPingAt = now;

    const parsed = PingPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      socket.emit('error', { code: 'INVALID_PAYLOAD', message: 'Invalid ping payload' });
      return;
    }

    const pong = PongPayloadSchema.parse({
      clientTime: parsed.data.clientTime,
      serverTime: Date.now(),
      message: 'pong',
    });

    socket.emit(SOCKET_EVENTS.PONG, pong);
  });
});

server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${env.PORT}`);
});
