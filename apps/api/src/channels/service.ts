import type { CreateChannelInput } from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { NotFound } from '../lib/errors.js';
import { assertMember, assertOwner } from '../guilds/service.js';

export async function createChannel(userId: string, guildId: string, input: CreateChannelInput) {
  await assertOwner(userId, guildId);
  const last = await prisma.channel.findFirst({
    where: { guildId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return prisma.channel.create({
    data: {
      guildId,
      name: input.name,
      type: input.type,
      topic: input.topic ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
}

export async function listChannels(userId: string, guildId: string) {
  await assertMember(userId, guildId);
  return prisma.channel.findMany({ where: { guildId }, orderBy: { position: 'asc' } });
}

export async function getChannel(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw NotFound('Channel not found');
  if (channel.guildId) await assertMember(userId, channel.guildId);
  return channel;
}

export async function deleteChannel(userId: string, channelId: string) {
  const channel = await getChannel(userId, channelId);
  if (channel.guildId) await assertOwner(userId, channel.guildId);
  await prisma.channel.delete({ where: { id: channelId } });
  return channel;
}
