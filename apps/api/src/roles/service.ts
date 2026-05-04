import { Permissions, parsePerm } from '@chat-vds/shared';
import type {
  CreateRoleInput,
  PutOverwriteInput,
  SetMemberRolesInput,
  UpdateRoleInput,
} from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import {
  resolveChannelPermissions,
  resolveGuildPermissions,
  requirePerm,
} from '../lib/permissions.js';
import { assertMember, assertOwner } from '../guilds/service.js';

export async function listRoles(userId: string, guildId: string) {
  await assertMember(userId, guildId);
  return prisma.role.findMany({
    where: { guildId },
    orderBy: [{ position: 'desc' }, { name: 'asc' }],
  });
}

export async function createRole(
  userId: string,
  guildId: string,
  input: CreateRoleInput,
) {
  const perms = await resolveGuildPermissions(userId, guildId);
  requirePerm(perms, Permissions.MANAGE_ROLES);

  // New role goes above @everyone, below highest custom role.
  const last = await prisma.role.findFirst({
    where: { guildId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return prisma.role.create({
    data: {
      guildId,
      name: input.name,
      color: input.color,
      permissions: input.permissions,
      position: (last?.position ?? 0) + 1,
      isEveryone: false,
    },
  });
}

export async function updateRole(
  userId: string,
  roleId: string,
  input: UpdateRoleInput,
) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw NotFound('Role not found');
  const perms = await resolveGuildPermissions(userId, role.guildId);
  requirePerm(perms, Permissions.MANAGE_ROLES);
  if (role.isEveryone && input.position !== undefined) {
    throw BadRequest('Cannot change @everyone position');
  }
  return prisma.role.update({
    where: { id: roleId },
    data: {
      name: input.name,
      color: input.color,
      permissions: input.permissions,
      position: input.position,
    },
  });
}

export async function deleteRole(userId: string, roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw NotFound('Role not found');
  if (role.isEveryone) throw BadRequest('Cannot delete @everyone');
  await assertOwner(userId, role.guildId).catch(async () => {
    const perms = await resolveGuildPermissions(userId, role.guildId);
    requirePerm(perms, Permissions.MANAGE_ROLES);
  });
  await prisma.role.delete({ where: { id: roleId } });
  return role;
}

export async function setMemberRoles(
  userId: string,
  guildId: string,
  targetUserId: string,
  input: SetMemberRolesInput,
) {
  const perms = await resolveGuildPermissions(userId, guildId);
  requirePerm(perms, Permissions.MANAGE_ROLES);
  const member = await prisma.member.findUnique({
    where: { userId_guildId: { userId: targetUserId, guildId } },
  });
  if (!member) throw NotFound('Member not found');
  // Drop @everyone — it's always implicit.
  const everyone = await prisma.role.findFirst({
    where: { guildId, isEveryone: true },
  });
  const allowedIds = new Set(
    (
      await prisma.role.findMany({
        where: { guildId, id: { in: input.roleIds } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  if (everyone) allowedIds.delete(everyone.id);
  const updated = await prisma.member.update({
    where: { id: member.id },
    data: {
      roles: { set: [...allowedIds].map((id) => ({ id })) },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      roles: { select: { id: true } },
    },
  });
  return {
    userId: updated.userId,
    guildId: updated.guildId,
    nickname: updated.nickname,
    user: updated.user,
    roles: updated.roles.map((r) => r.id),
  };
}

// ───────────────────────── Permission overwrites ─────────────────────────

export async function listOverwrites(userId: string, channelId: string) {
  await resolveChannelPermissions(userId, channelId);
  return prisma.permissionOverwrite.findMany({ where: { channelId } });
}

export async function putOverwrite(
  userId: string,
  channelId: string,
  input: PutOverwriteInput,
) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });
  if (!channel) throw NotFound('Channel not found');
  if (!channel.guildId) throw BadRequest('DM channels do not have overwrites');
  const perms = await resolveGuildPermissions(userId, channel.guildId);
  requirePerm(perms, Permissions.MANAGE_ROLES);

  // Validate overwrite target belongs to the guild.
  if (input.type === 'ROLE' && input.roleId) {
    const role = await prisma.role.findFirst({
      where: { id: input.roleId, guildId: channel.guildId },
    });
    if (!role) throw NotFound('Role not in this guild');
  }
  if (input.type === 'MEMBER' && input.userId) {
    const member = await prisma.member.findUnique({
      where: { userId_guildId: { userId: input.userId, guildId: channel.guildId } },
    });
    if (!member) throw NotFound('User not a member of this guild');
  }

  // Validate that allow/deny don't share bits.
  if ((parsePerm(input.allow) & parsePerm(input.deny)) !== 0n) {
    throw BadRequest('Cannot allow and deny the same permission');
  }

  if (input.type === 'ROLE' && input.roleId) {
    return prisma.permissionOverwrite.upsert({
      where: { channelId_roleId: { channelId, roleId: input.roleId } },
      create: {
        channelId,
        type: 'ROLE',
        roleId: input.roleId,
        allow: input.allow,
        deny: input.deny,
      },
      update: { allow: input.allow, deny: input.deny },
    });
  }
  if (input.type === 'MEMBER' && input.userId) {
    return prisma.permissionOverwrite.upsert({
      where: { channelId_userId: { channelId, userId: input.userId } },
      create: {
        channelId,
        type: 'MEMBER',
        userId: input.userId,
        allow: input.allow,
        deny: input.deny,
      },
      update: { allow: input.allow, deny: input.deny },
    });
  }
  throw BadRequest('Invalid overwrite payload');
}

export async function deleteOverwrite(
  userId: string,
  channelId: string,
  overwriteId: string,
) {
  const ow = await prisma.permissionOverwrite.findUnique({
    where: { id: overwriteId },
  });
  if (!ow || ow.channelId !== channelId) throw NotFound('Overwrite not found');
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });
  if (!channel?.guildId) throw Forbidden();
  const perms = await resolveGuildPermissions(userId, channel.guildId);
  requirePerm(perms, Permissions.MANAGE_ROLES);
  await prisma.permissionOverwrite.delete({ where: { id: overwriteId } });
  return ow;
}
