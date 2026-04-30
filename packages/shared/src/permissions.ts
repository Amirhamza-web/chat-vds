/**
 * Discord-style permission bit flags. Stored as BigInt in DB.
 */
export const Permissions = {
  CREATE_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 12n,
  ATTACH_FILES: 1n << 13n,
  ADD_REACTIONS: 1n << 14n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
} as const;

export type PermissionFlag = keyof typeof Permissions;

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
