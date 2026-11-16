import { Router } from 'express';
import type { Server } from 'socket.io';
import {
  BlockUserSchema,
  SOCKET_EVENTS,
  SearchUsersSchema,
  SendFriendRequestSchema,
  type FriendInfo,
  type FriendRequestInfo,
  type PublicUser,
  type UserRelation,
  type UserSearchResult,
} from '@boardgame/shared';
import { requireAuth, type AuthenticatedRequest } from '../auth';
import { prisma } from '../db';
import type { PresenceTracker } from '../presence';

export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

function toPublicUser(u: {
  id: string;
  username: string;
  avatarId: string;
  isGuest: boolean;
}): PublicUser {
  return {
    id: u.id,
    username: u.username,
    avatarId: u.avatarId,
    isGuest: u.isGuest,
  };
}

export function createFriendsRouter(io: Server, presence: PresenceTracker): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;

    const [friendships, incoming, outgoing, blocks] = await Promise.all([
      prisma.friendship.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        include: {
          userA: { select: { id: true, username: true, avatarId: true, isGuest: true } },
          userB: { select: { id: true, username: true, avatarId: true, isGuest: true } },
        },
      }),
      prisma.friendRequest.findMany({
        where: { toUserId: userId, status: 'PENDING' },
        include: {
          fromUser: { select: { id: true, username: true, avatarId: true, isGuest: true } },
          toUser: { select: { id: true, username: true, avatarId: true, isGuest: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: { fromUserId: userId, status: 'PENDING' },
        include: {
          fromUser: { select: { id: true, username: true, avatarId: true, isGuest: true } },
          toUser: { select: { id: true, username: true, avatarId: true, isGuest: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userBlock.findMany({
        where: { blockerId: userId },
        include: {
          blocked: { select: { id: true, username: true, avatarId: true, isGuest: true } },
        },
      }),
    ]);

    const friends: FriendInfo[] = friendships.map((f) => {
      const other = f.userAId === userId ? f.userB : f.userA;
      return {
        ...toPublicUser(other),
        presence: presence.getStatus(other.id),
      };
    });

    const mapReq = (r: (typeof incoming)[number]): FriendRequestInfo => ({
      id: r.id,
      fromUser: toPublicUser(r.fromUser),
      toUser: toPublicUser(r.toUser),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    });

    res.json({
      friends,
      incomingRequests: incoming.map(mapReq),
      outgoingRequests: outgoing.map(mapReq),
      blockedUsers: blocks.map((b) => toPublicUser(b.blocked)),
    });
  });

  router.get('/search', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const parsed = SearchUsersSchema.safeParse({ q: req.query.q });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Từ khoá không hợp lệ' });
      return;
    }

    const q = parsed.data.q;
    const [candidates, friendships, pendingReqs, blocks] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { not: userId },
          username: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, username: true, avatarId: true, isGuest: true },
        take: 20,
      }),
      prisma.friendship.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: { userAId: true, userBId: true },
      }),
      prisma.friendRequest.findMany({
        where: {
          status: 'PENDING',
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
        select: { id: true, fromUserId: true, toUserId: true },
      }),
      prisma.userBlock.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      }),
    ]);

    const friendSet = new Set(
      friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId)),
    );
    const blockedByThem = new Set(
      blocks.filter((b) => b.blockedId === userId).map((b) => b.blockerId),
    );
    const blockedByMe = new Set(
      blocks.filter((b) => b.blockerId === userId).map((b) => b.blockedId),
    );

    const results: UserSearchResult[] = candidates
      .filter((u) => !blockedByThem.has(u.id))
      .map((u) => {
        let relation: UserRelation = 'none';
        let requestId: string | undefined;

        if (blockedByMe.has(u.id)) {
          relation = 'blocked';
        } else if (friendSet.has(u.id)) {
          relation = 'friend';
        } else {
          const outReq = pendingReqs.find((r) => r.fromUserId === userId && r.toUserId === u.id);
          const inReq = pendingReqs.find((r) => r.toUserId === userId && r.fromUserId === u.id);
          if (outReq) {
            relation = 'outgoing_request';
            requestId = outReq.id;
          } else if (inReq) {
            relation = 'incoming_request';
            requestId = inReq.id;
          }
        }

        return { ...toPublicUser(u), relation, requestId };
      });

    res.json({ users: results });
  });

  router.post('/request', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const parsed = SendFriendRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Yêu cầu không hợp lệ' });
      return;
    }

    const { targetUserId } = parsed.data;
    if (targetUserId === userId) {
      res.status(400).json({ error: 'Không thể kết bạn với chính mình' });
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, avatarId: true, isGuest: true },
    });
    if (!target) {
      res.status(404).json({ error: 'Không tìm thấy người chơi' });
      return;
    }

    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: userId },
        ],
      },
    });
    if (block) {
      res.status(403).json({ error: 'Không thể gửi lời mời kết bạn cho người dùng này' });
      return;
    }

    const [userAId, userBId] = canonicalPair(userId, targetUserId);
    const existingFriend = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    if (existingFriend) {
      res.status(409).json({ error: 'Hai bạn đã là bạn bè' });
      return;
    }

    const reversePending = await prisma.friendRequest.findFirst({
      where: { fromUserId: targetUserId, toUserId: userId, status: 'PENDING' },
    });
    if (reversePending) {
      res.status(409).json({ error: 'Người này đã gửi lời mời kết bạn cho bạn' });
      return;
    }

    const request = await prisma.friendRequest.upsert({
      where: { fromUserId_toUserId: { fromUserId: userId, toUserId: targetUserId } },
      update: { status: 'PENDING' },
      create: { fromUserId: userId, toUserId: targetUserId, status: 'PENDING' },
      include: {
        fromUser: { select: { id: true, username: true, avatarId: true, isGuest: true } },
        toUser: { select: { id: true, username: true, avatarId: true, isGuest: true } },
      },
    });

    const payload: FriendRequestInfo = {
      id: request.id,
      fromUser: toPublicUser(request.fromUser),
      toUser: toPublicUser(request.toUser),
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    };

    io.to(`user:${targetUserId}`).emit(SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, payload);
    res.status(201).json({ request: payload });
  });

  router.post('/requests/:id/accept', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const requestId = String(req.params.id ?? '');

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        fromUser: { select: { id: true, username: true, avatarId: true, isGuest: true } },
        toUser: { select: { id: true, username: true, avatarId: true, isGuest: true } },
      },
    });

    if (!request || request.toUserId !== userId || request.status !== 'PENDING') {
      res.status(404).json({ error: 'Không tìm thấy lời mời kết bạn hợp lệ' });
      return;
    }

    const [userAId, userBId] = canonicalPair(request.fromUserId, request.toUserId);

    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: request.id },
        data: { status: 'ACCEPTED' },
      }),
      prisma.friendship.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      }),
    ]);

    const friendForSender: FriendInfo = {
      ...toPublicUser(request.toUser),
      presence: presence.getStatus(request.toUserId),
    };
    const friendForReceiver: FriendInfo = {
      ...toPublicUser(request.fromUser),
      presence: presence.getStatus(request.fromUserId),
    };

    io.to(`user:${request.fromUserId}`).emit(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, {
      requestId: request.id,
      status: 'ACCEPTED',
      friend: friendForSender,
    });
    io.to(`user:${request.toUserId}`).emit(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, {
      requestId: request.id,
      status: 'ACCEPTED',
      friend: friendForReceiver,
    });

    res.json({ ok: true, friend: friendForReceiver });
  });

  router.post('/requests/:id/decline', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const requestId = String(req.params.id ?? '');

    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.toUserId !== userId || request.status !== 'PENDING') {
      res.status(404).json({ error: 'Không tìm thấy lời mời kết bạn' });
      return;
    }

    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'DECLINED' },
    });

    io.to(`user:${request.fromUserId}`).emit(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, {
      requestId: request.id,
      status: 'DECLINED',
    });

    res.json({ ok: true });
  });

  router.post('/requests/:id/cancel', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const requestId = String(req.params.id ?? '');

    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.fromUserId !== userId || request.status !== 'PENDING') {
      res.status(404).json({ error: 'Không tìm thấy lời mời kết bạn' });
      return;
    }

    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELED' },
    });

    io.to(`user:${request.toUserId}`).emit(SOCKET_EVENTS.FRIEND_REQUEST_UPDATED, {
      requestId: request.id,
      status: 'CANCELED',
    });

    res.json({ ok: true });
  });

  router.delete('/:friendId', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const friendId = String(req.params.friendId ?? '');
    const [userAId, userBId] = canonicalPair(userId, friendId);

    const deleted = await prisma.friendship.deleteMany({
      where: { userAId, userBId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: 'Không tìm thấy bạn bè' });
      return;
    }

    io.to(`user:${friendId}`).emit(SOCKET_EVENTS.FRIEND_REMOVED, { userId });
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.FRIEND_REMOVED, { userId: friendId });
    res.json({ ok: true });
  });

  router.post('/block', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const parsed = BlockUserSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.targetUserId === userId) {
      res.status(400).json({ error: 'Người dùng không hợp lệ' });
      return;
    }

    const { targetUserId } = parsed.data;
    const [userAId, userBId] = canonicalPair(userId, targetUserId);

    await prisma.$transaction([
      prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
        update: {},
        create: { blockerId: userId, blockedId: targetUserId },
      }),
      prisma.friendship.deleteMany({ where: { userAId, userBId } }),
      prisma.friendRequest.updateMany({
        where: {
          status: 'PENDING',
          OR: [
            { fromUserId: userId, toUserId: targetUserId },
            { fromUserId: targetUserId, toUserId: userId },
          ],
        },
        data: { status: 'CANCELED' },
      }),
    ]);

    io.to(`user:${targetUserId}`).emit(SOCKET_EVENTS.FRIEND_REMOVED, { userId });
    res.json({ ok: true });
  });

  router.delete('/block/:targetId', async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const targetId = String(req.params.targetId ?? '');
    await prisma.userBlock.deleteMany({
      where: { blockerId: userId, blockedId: targetId },
    });
    res.json({ ok: true });
  });

  return router;
}
