import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { SocketEvents, type VoiceParticipantsPayload } from '@chat-vds/shared';
import { loadEnv } from '../config/env.js';
import { redisPub, redisSub } from '../lib/redis.js';
import { verifyAccessToken } from '../auth/jwt.js';
import { prisma } from '../db/prisma.js';
import { addSocket, getStatus, refreshPresence, removeSocket } from './presence.js';

const env = loadEnv();

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialised');
  return io;
}

export function attachSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN.split(','), credentials: true },
  });
  io.adapter(createAdapter(redisPub, redisSub));

  // Re-broadcast voice participants snapshots from the SFU process.
  const voiceSub = redisPub.duplicate();
  void voiceSub.subscribe('voice:participants');
  voiceSub.on('message', (_channel, raw) => {
    try {
      const payload = JSON.parse(raw) as VoiceParticipantsPayload;
      if (payload.guildId) {
        io?.to(`guild:${payload.guildId}`).emit(SocketEvents.VoiceParticipants, payload);
      }
    } catch {
      /* ignore malformed payloads */
    }
  });

  io.use(async (socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice(7)
        : undefined);
    if (!token) return next(new Error('Unauthorized'));
    const payload = verifyAccessToken(token);
    if (!payload) return next(new Error('Unauthorized'));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { displayName: true },
    });
    if (!user) return next(new Error('Unauthorized'));
    socket.data.userId = payload.sub;
    socket.data.username = payload.username;
    socket.data.displayName = user.displayName;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    const wasEmpty = await addSocket(userId, socket.id);
    if (wasEmpty) await broadcastPresenceForUser(userId);

    // Auto-join personal room and rooms for all guilds the user belongs to
    socket.join(`user:${userId}`);
    const memberships = await prisma.member.findMany({
      where: { userId },
      select: { guildId: true },
    });
    for (const m of memberships) socket.join(`guild:${m.guildId}`);

    const heartbeat = setInterval(() => {
      void refreshPresence(userId);
    }, 25_000);

    socket.on(SocketEvents.ChannelJoin, async (channelId: string) => {
      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) return;
      if (channel.guildId) {
        const m = await prisma.member.findUnique({
          where: { userId_guildId: { userId, guildId: channel.guildId } },
        });
        if (!m) return;
      }
      socket.join(`channel:${channelId}`);
    });

    socket.on(SocketEvents.ChannelLeave, (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on(SocketEvents.TypingStart, async (channelId: string) => {
      socket.to(`channel:${channelId}`).emit(SocketEvents.TypingUpdate, {
        channelId,
        userId,
        username: socket.data.username as string,
        displayName: (socket.data.displayName as string) ?? (socket.data.username as string),
      });
    });

    socket.on('disconnect', async () => {
      clearInterval(heartbeat);
      const empty = await removeSocket(userId, socket.id);
      if (empty) await broadcastPresenceForUser(userId);
    });
  });

  return io;
}

async function broadcastPresenceForUser(userId: string) {
  if (!io) return;
  const status = await getStatus(userId);
  // Notify rooms in every guild the user belongs to
  const memberships = await prisma.member.findMany({
    where: { userId },
    select: { guildId: true },
  });
  for (const m of memberships) {
    io.to(`guild:${m.guildId}`).emit(SocketEvents.PresenceUpdate, { userId, status });
  }
}

// ─────────── Broadcast helpers used by HTTP handlers ───────────

export function broadcastMessageNew(message: { channelId: string }) {
  io?.to(`channel:${message.channelId}`).emit(SocketEvents.MessageNew, message);
}
export function broadcastMessageUpdate(message: { channelId: string }) {
  io?.to(`channel:${message.channelId}`).emit(SocketEvents.MessageUpdate, message);
}
export function broadcastMessageDelete(message: { id: string; channelId: string }) {
  io?.to(`channel:${message.channelId}`).emit(SocketEvents.MessageDelete, {
    id: message.id,
    channelId: message.channelId,
  });
}
export function broadcastChannelCreate(channel: { guildId: string | null }) {
  if (!channel.guildId) return;
  io?.to(`guild:${channel.guildId}`).emit(SocketEvents.ChannelCreate, channel);
}
export function broadcastChannelDelete(channel: { id: string; guildId: string | null }) {
  if (!channel.guildId) return;
  io?.to(`guild:${channel.guildId}`).emit(SocketEvents.ChannelDelete, {
    id: channel.id,
    guildId: channel.guildId,
  });
}

/**
 * Make all currently-connected sockets for a user join the guild's room. Used
 * after invite acceptance so the new member receives `channel:create`,
 * presence, and message events without needing to reconnect.
 */
export async function joinUserToGuildRoom(userId: string, guildId: string): Promise<void> {
  if (!io) return;
  await io.in(`user:${userId}`).socketsJoin(`guild:${guildId}`);
}
export function broadcastGuildMemberAdd(guildId: string, member: unknown) {
  io?.to(`guild:${guildId}`).emit(SocketEvents.GuildMemberAdd, member);
}
