import { api } from '../../lib/http';
import type {
  ChannelDto,
  GuildWithChannels,
  MemberDto,
  PermissionOverwriteDto,
  RoleDto,
} from './types';

export function fetchGuilds(): Promise<GuildWithChannels[]> {
  return api<GuildWithChannels[]>('/guilds');
}

export function fetchGuild(id: string): Promise<GuildWithChannels> {
  return api<GuildWithChannels>(`/guilds/${id}`);
}

export function createGuild(name: string): Promise<GuildWithChannels> {
  return api<GuildWithChannels>('/guilds', { method: 'POST', body: { name } });
}

export function leaveGuild(id: string): Promise<void> {
  return api<void>(`/guilds/${id}/leave`, { method: 'POST' });
}

export function deleteGuild(id: string): Promise<void> {
  return api<void>(`/guilds/${id}`, { method: 'DELETE' });
}

export function createChannel(
  guildId: string,
  input: { name: string; type: 'TEXT' | 'VOICE' },
): Promise<{ id: string; name: string; type: string; guildId: string | null }> {
  return api(`/guilds/${guildId}/channels`, { method: 'POST', body: input });
}

export function deleteChannel(channelId: string): Promise<void> {
  return api<void>(`/channels/${channelId}`, { method: 'DELETE' });
}

export function createInvite(guildId: string): Promise<{ code: string }> {
  return api<{ code: string }>('/invites', {
    method: 'POST',
    body: { guildId, expiresInSec: 60 * 60 * 24 * 7 },
  });
}

// ───────────────────────── Members ─────────────────────────

export function fetchMembers(guildId: string): Promise<MemberDto[]> {
  return api<MemberDto[]>(`/guilds/${guildId}/members`);
}

// ───────────────────────── Roles ─────────────────────────

export function fetchRoles(guildId: string): Promise<RoleDto[]> {
  return api<RoleDto[]>(`/guilds/${guildId}/roles`);
}

export function createRole(
  guildId: string,
  input: { name: string; color?: number; permissions?: string },
): Promise<RoleDto> {
  return api<RoleDto>(`/guilds/${guildId}/roles`, {
    method: 'POST',
    body: input,
  });
}

export function updateRole(
  roleId: string,
  input: { name?: string; color?: number; permissions?: string; position?: number },
): Promise<RoleDto> {
  return api<RoleDto>(`/roles/${roleId}`, { method: 'PATCH', body: input });
}

export function deleteRole(roleId: string): Promise<void> {
  return api<void>(`/roles/${roleId}`, { method: 'DELETE' });
}

export function setMemberRoles(
  guildId: string,
  memberId: string,
  roleIds: string[],
): Promise<MemberDto> {
  return api<MemberDto>(`/guilds/${guildId}/members/${memberId}/roles`, {
    method: 'PUT',
    body: { roleIds },
  });
}

// ───────────────────────── Overwrites ─────────────────────────

export function fetchOverwrites(channelId: string): Promise<PermissionOverwriteDto[]> {
  return api<PermissionOverwriteDto[]>(`/channels/${channelId}/overwrites`);
}

export function putOverwrite(
  channelId: string,
  input: {
    type: 'ROLE' | 'MEMBER';
    roleId?: string;
    userId?: string;
    allow: string;
    deny: string;
  },
): Promise<PermissionOverwriteDto> {
  return api<PermissionOverwriteDto>(`/channels/${channelId}/overwrites`, {
    method: 'PUT',
    body: input,
  });
}

export function deleteOverwrite(
  channelId: string,
  overwriteId: string,
): Promise<void> {
  return api<void>(`/channels/${channelId}/overwrites/${overwriteId}`, {
    method: 'DELETE',
  });
}

// ───────────────────────── DMs ─────────────────────────

export function openDM(recipientId: string): Promise<ChannelDto> {
  return api<ChannelDto>('/dms', { method: 'POST', body: { recipientId } });
}

export function createGroupDM(
  recipientIds: string[],
  name?: string,
): Promise<ChannelDto> {
  return api<ChannelDto>('/dms/groups', {
    method: 'POST',
    body: { recipientIds, name },
  });
}

export function fetchDMs(): Promise<ChannelDto[]> {
  return api<ChannelDto[]>('/dms');
}

export function addDMRecipient(
  channelId: string,
  userId: string,
): Promise<ChannelDto> {
  return api<ChannelDto>(`/dms/${channelId}/recipients`, {
    method: 'POST',
    body: { userId },
  });
}

// ───────────────────────── Push ─────────────────────────

export function getVapidKey(): Promise<{ vapidPublicKey: string | null }> {
  return api('/push/vapid-key', { skipAuth: true });
}

export function subscribePush(
  subscription: PushSubscription,
): Promise<{ ok: boolean }> {
  const json = subscription.toJSON();
  return api('/push/subscribe', {
    method: 'POST',
    body: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    },
  });
}

export function unsubscribePush(endpoint: string): Promise<void> {
  return api('/push/unsubscribe', { method: 'POST', body: { endpoint } });
}
