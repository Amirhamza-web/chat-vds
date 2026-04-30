import { api } from '../../lib/http';
import type { GuildWithChannels } from './types';

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
