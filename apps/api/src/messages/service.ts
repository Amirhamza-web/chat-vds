import type { SendMessageInput } from '@chat-vds/shared';
import { Permissions, hasPermission } from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { Forbidden, NotFound } from '../lib/errors.js';
import {
  resolveChannelPermissions,
  requirePerm,
} from '../lib/permissions.js';
import {
  expandMentionRecipients,
  parseMentionMarkup,
  validateMentionsForChannel,
} from '../lib/mentions.js';

export async function sendMessage(
  userId: string,
  channelId: string,
  input: SendMessageInput,
) {
  const { channel, permissions } = await resolveChannelPermissions(
    userId,
    channelId,
  );
  if (channel.type !== 'TEXT' && channel.type !== 'DM')
    throw Forbidden('Cannot send messages to this channel');
  requirePerm(permissions, Permissions.VIEW_CHANNEL);
  requirePerm(permissions, Permissions.SEND_MESSAGES);
  if (input.attachmentIds && input.attachmentIds.length > 0) {
    requirePerm(permissions, Permissions.ATTACH_FILES);
  }

  const parsed = parseMentionMarkup(input.content);
  const validated = await validateMentionsForChannel(channelId, parsed);
  const canMentionEveryone = hasPermission(
    permissions,
    Permissions.MENTION_EVERYONE,
  );
  const mentionsEveryone = validated.everyone && canMentionEveryone;

  const message = await prisma.message.create({
    data: {
      channelId,
      authorId: userId,
      content: input.content,
      mentionsEveryone,
      attachments:
        input.attachmentIds && input.attachmentIds.length > 0
          ? { connect: input.attachmentIds.map((id) => ({ id })) }
          : undefined,
      mentions: {
        create: [
          ...validated.userIds.map((uid) => ({
            type: 'USER' as const,
            userId: uid,
          })),
          ...validated.roleIds.map((rid) => ({
            type: 'ROLE' as const,
            roleId: rid,
          })),
        ],
      },
    },
    include: messageInclude,
  });

  // Compute notify recipients (used by push delivery in routes).
  const notifyTargets = await expandMentionRecipients(channelId, userId, {
    userIds: validated.userIds,
    roleIds: validated.roleIds,
    everyone: mentionsEveryone,
  });

  return { message: serializeMessage(message), notifyTargets };
}

export async function listMessages(
  userId: string,
  channelId: string,
  opts: { before?: string; limit?: number } = {},
) {
  await resolveChannelPermissions(userId, channelId);
  const limit = Math.min(opts.limit ?? 50, 100);
  let cursorClause = {};
  if (opts.before) {
    const cursor = await prisma.message.findUnique({
      where: { id: opts.before },
      select: { createdAt: true },
    });
    if (cursor) cursorClause = { createdAt: { lt: cursor.createdAt } };
  }
  const messages = await prisma.message.findMany({
    where: { channelId, ...cursorClause },
    include: messageInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return messages.reverse().map(serializeMessage);
}

export async function editMessage(
  userId: string,
  messageId: string,
  content: string,
) {
  const m = await prisma.message.findUnique({ where: { id: messageId } });
  if (!m) throw NotFound('Message not found');
  if (m.authorId !== userId)
    throw Forbidden('You can only edit your own messages');

  const { permissions } = await resolveChannelPermissions(userId, m.channelId);
  const parsed = parseMentionMarkup(content);
  const validated = await validateMentionsForChannel(m.channelId, parsed);
  const mentionsEveryone =
    validated.everyone &&
    hasPermission(permissions, Permissions.MENTION_EVERYONE);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.messageMention.deleteMany({ where: { messageId } });
    return tx.message.update({
      where: { id: messageId },
      data: {
        content,
        editedAt: new Date(),
        mentionsEveryone,
        mentions: {
          create: [
            ...validated.userIds.map((uid) => ({
              type: 'USER' as const,
              userId: uid,
            })),
            ...validated.roleIds.map((rid) => ({
              type: 'ROLE' as const,
              roleId: rid,
            })),
          ],
        },
      },
      include: messageInclude,
    });
  });
  return serializeMessage(updated);
}

export async function deleteMessage(userId: string, messageId: string) {
  const m = await prisma.message.findUnique({
    where: { id: messageId },
    include: { channel: true },
  });
  if (!m) throw NotFound('Message not found');

  if (m.authorId !== userId) {
    const { permissions } = await resolveChannelPermissions(
      userId,
      m.channelId,
    );
    requirePerm(permissions, Permissions.MANAGE_MESSAGES);
  }
  await prisma.message.delete({ where: { id: messageId } });
  return { id: m.id, channelId: m.channelId };
}

export async function pinMessage(userId: string, messageId: string) {
  const m = await prisma.message.findUnique({ where: { id: messageId } });
  if (!m) throw NotFound('Message not found');
  const { permissions } = await resolveChannelPermissions(userId, m.channelId);
  requirePerm(permissions, Permissions.MANAGE_MESSAGES, 'Cannot pin messages');
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { pinned: true, pinnedAt: new Date(), pinnedById: userId },
    include: messageInclude,
  });
  return serializeMessage(updated);
}

export async function unpinMessage(userId: string, messageId: string) {
  const m = await prisma.message.findUnique({ where: { id: messageId } });
  if (!m) throw NotFound('Message not found');
  const { permissions } = await resolveChannelPermissions(userId, m.channelId);
  requirePerm(permissions, Permissions.MANAGE_MESSAGES, 'Cannot unpin messages');
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { pinned: false, pinnedAt: null, pinnedById: null },
    include: messageInclude,
  });
  return serializeMessage(updated);
}

export async function listPinnedMessages(userId: string, channelId: string) {
  await resolveChannelPermissions(userId, channelId);
  const messages = await prisma.message.findMany({
    where: { channelId, pinned: true },
    include: messageInclude,
    orderBy: { pinnedAt: 'desc' },
    take: 50,
  });
  return messages.map(serializeMessage);
}

export async function searchMessages(
  userId: string,
  opts: {
    q: string;
    guildId?: string;
    channelId?: string;
    authorId?: string;
    limit: number;
  },
) {
  // Resolve a list of channel ids the user can search in.
  let channelIds: string[];
  if (opts.channelId) {
    await resolveChannelPermissions(userId, opts.channelId);
    channelIds = [opts.channelId];
  } else if (opts.guildId) {
    const member = await prisma.member.findUnique({
      where: { userId_guildId: { userId, guildId: opts.guildId } },
    });
    if (!member) throw Forbidden('Not a member of this guild');
    const channels = await prisma.channel.findMany({
      where: { guildId: opts.guildId, type: 'TEXT' },
      select: { id: true },
    });
    channelIds = channels.map((c) => c.id);
  } else {
    // Search across all guilds + DMs the user can access.
    const [members, dmIds] = await Promise.all([
      prisma.member.findMany({
        where: { userId },
        select: { guildId: true },
      }),
      prisma.dMRecipient.findMany({
        where: { userId },
        select: { channelId: true },
      }),
    ]);
    const guildIds = members.map((m) => m.guildId);
    const guildChannels = guildIds.length
      ? await prisma.channel.findMany({
          where: { guildId: { in: guildIds }, type: 'TEXT' },
          select: { id: true },
        })
      : [];
    channelIds = [
      ...guildChannels.map((c) => c.id),
      ...dmIds.map((d) => d.channelId),
    ];
  }
  if (channelIds.length === 0) return [];

  const messages = await prisma.message.findMany({
    where: {
      channelId: { in: channelIds },
      authorId: opts.authorId,
      content: { contains: opts.q, mode: 'insensitive' },
    },
    include: messageInclude,
    orderBy: { createdAt: 'desc' },
    take: opts.limit,
  });
  return messages.map(serializeMessage);
}

export const messageInclude = {
  author: {
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  },
  attachments: true,
  reactions: {
    select: { id: true, emoji: true, userId: true },
  },
  mentions: {
    select: { type: true, userId: true, roleId: true },
  },
} as const;

type RawMessage = Awaited<
  ReturnType<typeof prisma.message.findFirstOrThrow>
> & {
  author: { id: string; username: string; displayName: string; avatarUrl: string | null };
  attachments: { id: string; url: string; filename: string; size: number; mimeType: string }[];
  reactions: { id: string; emoji: string; userId: string }[];
  mentions: { type: 'USER' | 'ROLE'; userId: string | null; roleId: string | null }[];
};

export function serializeMessage(m: RawMessage) {
  // Aggregate reactions by emoji.
  const grouped = new Map<string, { emoji: string; userIds: string[] }>();
  for (const r of m.reactions) {
    const entry = grouped.get(r.emoji) ?? { emoji: r.emoji, userIds: [] };
    entry.userIds.push(r.userId);
    grouped.set(r.emoji, entry);
  }
  const reactions = [...grouped.values()].map((g) => ({
    emoji: g.emoji,
    count: g.userIds.length,
    userIds: g.userIds.slice(0, 50),
  }));

  return {
    id: m.id,
    channelId: m.channelId,
    authorId: m.authorId,
    author: m.author,
    content: m.content,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    editedAt: m.editedAt
      ? m.editedAt instanceof Date
        ? m.editedAt.toISOString()
        : m.editedAt
      : null,
    pinned: m.pinned,
    pinnedAt: m.pinnedAt
      ? m.pinnedAt instanceof Date
        ? m.pinnedAt.toISOString()
        : m.pinnedAt
      : null,
    pinnedById: m.pinnedById,
    mentionsEveryone: m.mentionsEveryone,
    attachments: m.attachments,
    reactions,
    mentions: m.mentions.map((mn) => ({
      type: mn.type,
      userId: mn.userId,
      roleId: mn.roleId,
    })),
  };
}
