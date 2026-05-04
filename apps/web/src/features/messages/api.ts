import { api } from '../../lib/http';
import type { MessageDto, ReactionSummaryDto } from './types';

export function fetchMessages(channelId: string, before?: string): Promise<MessageDto[]> {
  return api<MessageDto[]>(`/channels/${channelId}/messages`, {
    query: { before, limit: 50 },
  });
}

export function sendMessage(
  channelId: string,
  content: string,
  attachmentIds?: string[],
): Promise<MessageDto> {
  return api<MessageDto>(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: { content, attachmentIds },
  });
}

export function uploadAttachment(file: File): Promise<{ id: string; url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return api<{ id: string; url: string }>('/uploads', { method: 'POST', formData: fd });
}

export function pinMessage(messageId: string): Promise<MessageDto> {
  return api<MessageDto>(`/messages/${messageId}/pin`, { method: 'PUT' });
}

export function unpinMessage(messageId: string): Promise<MessageDto> {
  return api<MessageDto>(`/messages/${messageId}/pin`, { method: 'DELETE' });
}

export function fetchPinnedMessages(channelId: string): Promise<MessageDto[]> {
  return api<MessageDto[]>(`/channels/${channelId}/pins`);
}

export function addReaction(messageId: string, emoji: string): Promise<void> {
  return api(`/messages/${messageId}/reactions`, {
    method: 'PUT',
    body: { emoji },
  });
}

export function removeReaction(messageId: string, emoji: string): Promise<void> {
  return api(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
    method: 'DELETE',
  });
}

export function fetchReactions(messageId: string): Promise<ReactionSummaryDto[]> {
  return api<ReactionSummaryDto[]>(`/messages/${messageId}/reactions`);
}

export function searchMessages(params: {
  q: string;
  guildId?: string;
  channelId?: string;
  authorId?: string;
  limit?: number;
}): Promise<MessageDto[]> {
  return api<MessageDto[]>('/messages/search', { query: params as Record<string, string | number | undefined> });
}
