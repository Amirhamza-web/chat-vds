import type { CreateGroupDMInput, OpenDMInput } from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

/** Open or find an existing 1-on-1 DM channel. */
export async function openDM(userId: string, input: OpenDMInput) {
  if (userId === input.recipientId) throw BadRequest('Cannot DM yourself');
  const existing = await prisma.channel.findFirst({
    where: {
      type: 'DM',
      dmKind: 'DIRECT',
      dmRecipients: {
        every: {
          userId: { in: [userId, input.recipientId] },
        },
      },
      AND: [
        { dmRecipients: { some: { userId } } },
        { dmRecipients: { some: { userId: input.recipientId } } },
      ],
    },
    include: { dmRecipients: { include: { user: userSelect } } },
  });
  if (existing) return formatDMChannel(existing);

  const other = await prisma.user.findUnique({
    where: { id: input.recipientId },
    select: { id: true, displayName: true },
  });
  if (!other) throw NotFound('User not found');

  const channel = await prisma.channel.create({
    data: {
      type: 'DM',
      dmKind: 'DIRECT',
      name: '', // display name comes from recipients
      position: 0,
      dmRecipients: {
        create: [{ userId }, { userId: input.recipientId }],
      },
    },
    include: { dmRecipients: { include: { user: userSelect } } },
  });
  return formatDMChannel(channel);
}

/** Create a group DM (≤ 10 people). */
export async function createGroupDM(userId: string, input: CreateGroupDMInput) {
  const allIds = Array.from(new Set([userId, ...input.recipientIds]));
  if (allIds.length < 2)
    throw BadRequest('A group DM needs at least 2 people');
  if (allIds.length > 10) throw BadRequest('Group DM max is 10 people');

  // Verify all users exist.
  const users = await prisma.user.findMany({
    where: { id: { in: allIds } },
    select: { id: true },
  });
  if (users.length !== allIds.length) throw NotFound('One or more users not found');

  const channel = await prisma.channel.create({
    data: {
      type: 'DM',
      dmKind: 'GROUP',
      name: input.name ?? '',
      position: 0,
      dmOwnerId: userId,
      dmRecipients: {
        create: allIds.map((id) => ({ userId: id })),
      },
    },
    include: { dmRecipients: { include: { user: userSelect } } },
  });
  return formatDMChannel(channel);
}

/** Add a recipient to a group DM. */
export async function addRecipient(
  userId: string,
  channelId: string,
  targetUserId: string,
) {
  const ch = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { dmRecipients: true },
  });
  if (!ch || ch.type !== 'DM' || ch.dmKind !== 'GROUP')
    throw NotFound('Group DM not found');
  if (ch.dmOwnerId !== userId)
    throw Forbidden('Only the group owner can add people');
  if (ch.dmRecipients.length >= 10)
    throw BadRequest('Group DM max is 10 people');
  if (ch.dmRecipients.some((r) => r.userId === targetUserId))
    throw BadRequest('User already in group');

  await prisma.dMRecipient.create({
    data: { channelId, userId: targetUserId },
  });
  return getDMChannel(userId, channelId);
}

/** Remove a recipient from a group DM. */
export async function removeRecipient(
  userId: string,
  channelId: string,
  targetUserId: string,
) {
  const ch = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { dmRecipients: true },
  });
  if (!ch || ch.type !== 'DM' || ch.dmKind !== 'GROUP')
    throw NotFound('Group DM not found');
  if (ch.dmOwnerId !== userId && userId !== targetUserId)
    throw Forbidden('Only the group owner can remove people');
  await prisma.dMRecipient.deleteMany({
    where: { channelId, userId: targetUserId },
  });
  return getDMChannel(userId, channelId);
}

/** List all DM channels the user is part of. */
export async function listDMs(userId: string) {
  const channels = await prisma.channel.findMany({
    where: {
      type: 'DM',
      dmRecipients: { some: { userId } },
    },
    include: { dmRecipients: { include: { user: userSelect } } },
    orderBy: { createdAt: 'desc' },
  });
  return channels.map(formatDMChannel);
}

export async function getDMChannel(userId: string, channelId: string) {
  const ch = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { dmRecipients: { include: { user: userSelect } } },
  });
  if (!ch || ch.type !== 'DM') throw NotFound('DM channel not found');
  if (!ch.dmRecipients.some((r) => r.userId === userId))
    throw Forbidden('Not a member of this DM');
  return formatDMChannel(ch);
}

const userSelect = {
  select: {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
  },
} as const;

type ChannelWithRecipients = Awaited<ReturnType<typeof prisma.channel.findUniqueOrThrow>> & {
  dmRecipients: { user: { id: string; username: string; displayName: string; avatarUrl: string | null } }[];
};

function formatDMChannel(ch: ChannelWithRecipients) {
  return {
    id: ch.id,
    guildId: null,
    name: ch.name,
    type: ch.type,
    position: ch.position,
    topic: ch.topic,
    parentId: ch.parentId,
    dmKind: ch.dmKind,
    dmOwnerId: ch.dmOwnerId,
    recipients: ch.dmRecipients.map((r) => r.user),
  };
}
