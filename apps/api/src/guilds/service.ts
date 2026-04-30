import type { CreateGuildInput } from '@chat-vds/shared';
import { DEFAULT_EVERYONE_PERMS } from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { Forbidden, NotFound } from '../lib/errors.js';

export async function createGuild(ownerId: string, input: CreateGuildInput) {
  return prisma.$transaction(async (tx) => {
    const guild = await tx.guild.create({
      data: { name: input.name, ownerId },
    });
    await tx.member.create({ data: { userId: ownerId, guildId: guild.id } });
    await tx.role.create({
      data: {
        guildId: guild.id,
        name: '@everyone',
        position: 0,
        permissions: DEFAULT_EVERYONE_PERMS.toString(),
      },
    });
    await tx.channel.create({
      data: { guildId: guild.id, name: 'general', type: 'TEXT', position: 0 },
    });
    await tx.channel.create({
      data: { guildId: guild.id, name: 'general-voice', type: 'VOICE', position: 1 },
    });
    return tx.guild.findUniqueOrThrow({
      where: { id: guild.id },
      include: { channels: { orderBy: { position: 'asc' } } },
    });
  });
}

export async function listUserGuilds(userId: string) {
  const guilds = await prisma.guild.findMany({
    where: { members: { some: { userId } } },
    include: { channels: { orderBy: { position: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
  return guilds;
}

export async function getGuild(userId: string, guildId: string) {
  await assertMember(userId, guildId);
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { channels: { orderBy: { position: 'asc' } } },
  });
  if (!guild) throw NotFound('Guild not found');
  return guild;
}

export async function listMembers(userId: string, guildId: string) {
  await assertMember(userId, guildId);
  return prisma.member.findMany({
    where: { guildId },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      roles: true,
    },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function deleteGuild(userId: string, guildId: string) {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) throw NotFound('Guild not found');
  if (guild.ownerId !== userId) throw Forbidden('Only owner can delete the guild');
  await prisma.guild.delete({ where: { id: guildId } });
}

export async function leaveGuild(userId: string, guildId: string) {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) throw NotFound('Guild not found');
  if (guild.ownerId === userId) throw Forbidden('Owner cannot leave; delete guild instead');
  await prisma.member.deleteMany({ where: { userId, guildId } });
}

export async function assertMember(userId: string, guildId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_guildId: { userId, guildId } },
  });
  if (!m) throw Forbidden('Not a member of this guild');
  return m;
}

export async function assertOwner(userId: string, guildId: string) {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) throw NotFound('Guild not found');
  if (guild.ownerId !== userId) throw Forbidden('Owner only');
  return guild;
}
