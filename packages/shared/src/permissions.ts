/**
 * Discord-style permission bit flags. Stored as BigInt-decimal-string in DB.
 */
export const Permissions = {
  CREATE_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 12n,
  ATTACH_FILES: 1n << 13n,
  ADD_REACTIONS: 1n << 14n,
  MENTION_EVERYONE: 1n << 15n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
} as const;

export type PermissionFlag = keyof typeof Permissions;

export const ALL_PERMISSION_FLAGS: PermissionFlag[] = Object.keys(
  Permissions,
) as PermissionFlag[];

export const DEFAULT_EVERYONE_PERMS =
  Permissions.VIEW_CHANNEL |
  Permissions.SEND_MESSAGES |
  Permissions.ATTACH_FILES |
  Permissions.ADD_REACTIONS |
  Permissions.CONNECT |
  Permissions.SPEAK |
  Permissions.CREATE_INVITE;

export function hasPermission(perms: bigint, flag: bigint): boolean {
  if ((perms & Permissions.ADMINISTRATOR) !== 0n) return true;
  return (perms & flag) === flag;
}

export function combinePermissions(...perms: bigint[]): bigint {
  return perms.reduce((acc, p) => acc | p, 0n);
}

/** Safely parse a permission bigint string from DB or wire format. */
export function parsePerm(value: string | null | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export interface RoleLite {
  id: string;
  permissions: string;
  position: number;
  isEveryone: boolean;
}

export interface ChannelOverwriteLite {
  /** ROLE or MEMBER */
  type: 'ROLE' | 'MEMBER';
  roleId: string | null;
  userId: string | null;
  allow: string;
  deny: string;
}

export interface PermissionContext {
  /** All roles in the guild. Must include @everyone. */
  guildRoles: RoleLite[];
  /** Roles assigned to the member (role ids). */
  memberRoleIds: string[];
  /** Whether the user is the guild owner. */
  isGuildOwner: boolean;
  /** Per-channel overwrites for the channel being checked. */
  overwrites: ChannelOverwriteLite[];
  userId: string;
}

/**
 * Compute the effective permission bitmask for a member in a specific channel,
 * applying Discord's permission-overwrite resolution order:
 *   1. Base permissions = OR of all role permissions (incl. @everyone).
 *   2. If ADMINISTRATOR or guild owner → all permissions.
 *   3. Apply @everyone overwrite (deny then allow).
 *   4. Apply role overwrites (combined deny then allow).
 *   5. Apply member overwrite (deny then allow).
 */
export function computeChannelPermissions(ctx: PermissionContext): bigint {
  if (ctx.isGuildOwner) {
    return ALL_PERMISSION_FLAGS.reduce(
      (acc, k) => acc | Permissions[k],
      Permissions.ADMINISTRATOR,
    );
  }

  const everyoneRole = ctx.guildRoles.find((r) => r.isEveryone);
  const memberRoles = ctx.guildRoles.filter((r) =>
    ctx.memberRoleIds.includes(r.id),
  );

  let base = parsePerm(everyoneRole?.permissions ?? '0');
  for (const r of memberRoles) base |= parsePerm(r.permissions);

  if ((base & Permissions.ADMINISTRATOR) !== 0n) {
    return ALL_PERMISSION_FLAGS.reduce(
      (acc, k) => acc | Permissions[k],
      Permissions.ADMINISTRATOR,
    );
  }

  // 1. @everyone channel overwrite.
  if (everyoneRole) {
    const ow = ctx.overwrites.find(
      (o) => o.type === 'ROLE' && o.roleId === everyoneRole.id,
    );
    if (ow) {
      base &= ~parsePerm(ow.deny);
      base |= parsePerm(ow.allow);
    }
  }

  // 2. Combined role overwrites (deny first, then allow).
  let rolesAllow = 0n;
  let rolesDeny = 0n;
  for (const r of memberRoles) {
    if (everyoneRole && r.id === everyoneRole.id) continue;
    const ow = ctx.overwrites.find(
      (o) => o.type === 'ROLE' && o.roleId === r.id,
    );
    if (!ow) continue;
    rolesAllow |= parsePerm(ow.allow);
    rolesDeny |= parsePerm(ow.deny);
  }
  base &= ~rolesDeny;
  base |= rolesAllow;

  // 3. Member overwrite.
  const memberOw = ctx.overwrites.find(
    (o) => o.type === 'MEMBER' && o.userId === ctx.userId,
  );
  if (memberOw) {
    base &= ~parsePerm(memberOw.deny);
    base |= parsePerm(memberOw.allow);
  }

  return base;
}

/** Compute the OR of all role permissions for a member at the guild level. */
export function computeGuildPermissions(
  ctx: Pick<PermissionContext, 'guildRoles' | 'memberRoleIds' | 'isGuildOwner'>,
): bigint {
  if (ctx.isGuildOwner) {
    return ALL_PERMISSION_FLAGS.reduce(
      (acc, k) => acc | Permissions[k],
      Permissions.ADMINISTRATOR,
    );
  }
  const everyoneRole = ctx.guildRoles.find((r) => r.isEveryone);
  let base = parsePerm(everyoneRole?.permissions ?? '0');
  for (const r of ctx.guildRoles.filter((r) =>
    ctx.memberRoleIds.includes(r.id),
  )) {
    base |= parsePerm(r.permissions);
  }
  return base;
}
