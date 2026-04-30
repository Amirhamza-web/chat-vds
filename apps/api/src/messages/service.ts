import type { SendMessageInput } from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { Forbidden, NotFound } from '../lib/errors.js';
import { assertMember } from '../guilds/service.js';

export async function sendMessage(userId: string, channelId: string, input: SendMessageInput) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw NotFound('Channel not found');
  if (channel.type !== 'TEXT' && channel.type !== 'DM')
    throw Forbidden('Cannot send messages to this channel');
  if (channel.guildId) await assertMember(userId, channel.guildId);

  const message = await prisma.message.create({
    data: {
      channelId,
      authorId: userId,
      content: input.content,
      attachments:
        input.attachmentIds && input.attachmentIds.length > 0
          ? {
              connect: input.attachmentIds.map((id) => ({ id })),
            }
          : undefined,
    },
    include: messageInclude,
  });
  return message;
}

export async function listMessages(
  userId: string,
  channelId: string,
  opts: { before?: string; limit?: number } = {},
) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw NotFound('Channel not found');
  if (channel.guildId) await assertMember(userId, channel.guildId);
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
  return messages.reverse();
}

export async function editMessage(userId: string, messageId: string, content: string) {
  const m = await prisma.message.findUnique({ where: { id: messageId } });
  if (!m) throw NotFound('Message not found');
  if (m.authorId !== userId) throw Forbidden('You can only edit your own messages');
  return prisma.message.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: messageInclude,
  });
}

export async function deleteMessage(userId: string, messageId: string) {
  const m = await prisma.message.findUnique({
    where: { id: messageId },
    include: { channel: true },
  });
  if (!m) throw NotFound('Message not found');
  if (m.authorId !== userId) {
    if (m.channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: m.channel.guildId } });
      if (!guild || guild.ownerId !== userId) throw Forbidden();
    } else {
      throw Forbidden();
    }
  }
  await prisma.message.delete({ where: { id: messageId } });
  return m;
}

export const messageInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  attachments: true,
} as const;
