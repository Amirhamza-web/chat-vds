import type { Channel } from '@prisma/client';
import {
  Permissions,
  computeChannelPermissions,
  computeGuildPermissions,
  hasPermission as hasPermBigint,
  parsePerm,
} from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { Forbidden, NotFound } from './errors.js';

export interface MemberPermissionResult {
  channel: Channel;
  isGuildOwner: boolean;
  permissions: bigint;
}

/**
 * Resolve effective channel permissions for a user.
 * Throws NotFound if channel doesn't exist, Forbidden if no membership.
 *
 * For DM channels (no guild), returns ADMINISTRATOR-equivalent perms for
 * recipients and Forbidden for non-recipients.
 */
export async function resolveChannelPermissions(
  userId: string,
  channelId: string,
): Promise<MemberPermissionResult> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw NotFound('Channel not found');

  if (!channel.guildId) {
    // DM channel: must be a recipient.
    const recipient = await prisma.dMRecipient.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!recipient) throw Forbidden('Not a member of this DM');
    // Give DM members a permissive bitmask (no guild concept here).
    const dmPerms =
      Permissions.VIEW_CHANNEL |
      Permissions.SEND_MESSAGES |
      Permissions.ATTACH_FILES |
      Permissions.ADD_REACTIONS |
      Permissions.MANAGE_MESSAGES; // own messages only — enforced in service
    return { channel, isGuildOwner: false, permissions: dmPerms };
  }

  const [guild, member, roles, overwrites] = await Promise.all([
    prisma.guild.findUniqueOrThrow({
      where: { id: channel.guildId },
      select: { ownerId: true },
    }),
    prisma.member.findUnique({
      where: { userId_guildId: { userId, guildId: channel.guildId } },
      include: { roles: { select: { id: true } } },
    }),
    prisma.role.findMany({
      where: { guildId: channel.guildId },
      select: {
        id: true,
        permissions: true,
        position: true,
        isEveryone: true,
      },
    }),
    prisma.permissionOverwrite.findMany({ where: { channelId } }),
  ]);

  if (!member) throw Forbidden('Not a member of this guild');

  const isGuildOwner = guild.ownerId === userId;
  const permissions = computeChannelPermissions({
    userId,
    isGuildOwner,
    guildRoles: roles.map((r) => ({
      id: r.id,
      permissions: r.permissions,
      position: r.position,
      isEveryone: r.isEveryone,
    })),
    memberRoleIds: member.roles.map((r) => r.id),
    overwrites: overwrites.map((o) => ({
      type: o.type,
      roleId: o.roleId,
      userId: o.userId,
      allow: o.allow,
      deny: o.deny,
    })),
  });

  return { channel, isGuildOwner, permissions };
}

/**
 * Resolve guild-level permissions (no channel context). Used for role / guild
 * management endpoints.
 */
export async function resolveGuildPermissions(
  userId: string,
  guildId: string,
): Promise<bigint> {
  const [guild, member, roles] = await Promise.all([
    prisma.guild.findUnique({
      where: { id: guildId },
      select: { ownerId: true },
    }),
    prisma.member.findUnique({
      where: { userId_guildId: { userId, guildId } },
      include: { roles: { select: { id: true } } },
    }),
    prisma.role.findMany({
      where: { guildId },
      select: { id: true, permissions: true, position: true, isEveryone: true },
    }),
  ]);
  if (!guild) throw NotFound('Guild not found');
  if (!member) throw Forbidden('Not a member of this guild');
  return computeGuildPermissions({
    isGuildOwner: guild.ownerId === userId,
    guildRoles: roles,
    memberRoleIds: member.roles.map((r) => r.id),
  });
}

/** Throw Forbidden unless the channel permission bitmask includes `flag`. */
export function requirePerm(perms: bigint, flag: bigint, msg?: string): void {
  if (!hasPermBigint(perms, flag)) {
    throw Forbidden(msg ?? 'Missing required permission');
  }
}

export function permsHas(value: string, flag: bigint): boolean {
  return hasPermBigint(parsePerm(value), flag);
}
