import { api } from '../../lib/http';
import type { MessageDto } from './types';

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
