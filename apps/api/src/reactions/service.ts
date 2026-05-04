import { Permissions } from '@chat-vds/shared';
import type { AddReactionInput } from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { Conflict, NotFound } from '../lib/errors.js';
import {
  resolveChannelPermissions,
  requirePerm,
} from '../lib/permissions.js';

export async function addReaction(
  userId: string,
  messageId: string,
  input: AddReactionInput,
) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw NotFound('Message not found');

  const { permissions } = await resolveChannelPermissions(userId, msg.channelId);
  requirePerm(permissions, Permissions.ADD_REACTIONS);

  const existing = await prisma.reaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId, userId, emoji: input.emoji },
    },
  });
  if (existing) throw Conflict('Already reacted with this emoji');

  await prisma.reaction.create({
    data: { messageId, userId, emoji: input.emoji },
  });
  return { messageId, channelId: msg.channelId, emoji: input.emoji, userId };
}

export async function removeReaction(
  userId: string,
  messageId: string,
  emoji: string,
) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw NotFound('Message not found');

  const reaction = await prisma.reaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });
  if (!reaction) throw NotFound('Reaction not found');

  await prisma.reaction.delete({ where: { id: reaction.id } });
  return { messageId, channelId: msg.channelId, emoji, userId };
}

export async function listReactions(userId: string, messageId: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw NotFound('Message not found');
  await resolveChannelPermissions(userId, msg.channelId);

  const reactions = await prisma.reaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
    orderBy: { createdAt: 'asc' },
  });

  const grouped = new Map<string, string[]>();
  for (const r of reactions) {
    const arr = grouped.get(r.emoji) ?? [];
    arr.push(r.userId);
    grouped.set(r.emoji, arr);
  }
  return [...grouped.entries()].map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    userIds: userIds.slice(0, 50),
  }));
}
