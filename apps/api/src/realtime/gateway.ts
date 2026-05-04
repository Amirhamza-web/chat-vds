import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import {
  SocketEvents,
  type MentionNotificationPayload,
  type PinUpdatePayload,
  type ReactionEventPayload,
  type VoiceParticipantsPayload,
} from '@chat-vds/shared';
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

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice(7)
        : undefined);
    if (!token) return next(new Error('Unauthorized'));
    const payload = verifyAccessToken(token);
    if (!payload) return next(new Error('Unauthorized'));
    socket.data.userId = payload.sub;
    socket.data.username = payload.username;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    const wasEmpty = await addSocket(userId, socket.id);
    if (wasEmpty) await broadcastPresenceForUser(userId);

    // Auto-join personal room and rooms for all guilds the user belongs to.
    socket.join(`user:${userId}`);
    const memberships = await prisma.member.findMany({
      where: { userId },
      select: { guildId: true },
    });
    for (const m of memberships) socket.join(`guild:${m.guildId}`);

    // Also auto-join DM rooms.
    const dmChannels = await prisma.dMRecipient.findMany({
      where: { userId },
      select: { channelId: true },
    });
    for (const d of dmChannels) socket.join(`channel:${d.channelId}`);

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
      } else if (channel.type === 'DM') {
        const r = await prisma.dMRecipient.findUnique({
          where: { channelId_userId: { channelId, userId } },
        });
        if (!r) return;
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
export function broadcastPinUpdate(payload: PinUpdatePayload) {
  io?.to(`channel:${payload.channelId}`).emit(SocketEvents.MessagePinUpdate, payload);
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
export function broadcastChannelUpdate(channelId: string) {
  // Emit to the channel room itself; clients listening can refresh overwrites.
  io?.to(`channel:${channelId}`).emit(SocketEvents.ChannelUpdate, { channelId });
}
export function broadcastGuildMemberAdd(guildId: string, member: unknown) {
  io?.to(`guild:${guildId}`).emit(SocketEvents.GuildMemberAdd, member);
}
export function broadcastMemberUpdate(guildId: string, member: unknown) {
  io?.to(`guild:${guildId}`).emit(SocketEvents.GuildMemberUpdate, member);
}
export function broadcastRoleCreate(role: { guildId: string }) {
  io?.to(`guild:${role.guildId}`).emit(SocketEvents.RoleCreate, role);
}
export function broadcastRoleUpdate(role: { guildId: string }) {
  io?.to(`guild:${role.guildId}`).emit(SocketEvents.RoleUpdate, role);
}
export function broadcastRoleDelete(role: { guildId: string; id: string }) {
  io?.to(`guild:${role.guildId}`).emit(SocketEvents.RoleDelete, { id: role.id, guildId: role.guildId });
}
export function broadcastReactionAdd(payload: ReactionEventPayload) {
  io?.to(`channel:${payload.channelId}`).emit(SocketEvents.ReactionAdd, payload);
}
export function broadcastReactionRemove(payload: ReactionEventPayload) {
  io?.to(`channel:${payload.channelId}`).emit(SocketEvents.ReactionRemove, payload);
}
export function notifyMentions(targetUserIds: string[], message: { channelId: string; id: string; author: { displayName: string }; content: string }) {
  if (!io) return;
  const payload: MentionNotificationPayload = {
    channelId: message.channelId,
    guildId: null,
    messageId: message.id,
    authorDisplayName: message.author.displayName,
    preview: message.content.slice(0, 200),
  };
  for (const uid of targetUserIds) {
    io.to(`user:${uid}`).emit(SocketEvents.Mention, payload);
  }
}
