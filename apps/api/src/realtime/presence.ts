import { redis } from '../lib/redis.js';
import type { PresenceStatus } from '@chat-vds/shared';

const KEY = (userId: string) => `presence:user:${userId}`;
const TTL_SEC = 60;

export async function addSocket(userId: string, socketId: string): Promise<boolean> {
  const wasEmpty = (await redis.scard(KEY(userId))) === 0;
  await redis.sadd(KEY(userId), socketId);
  await redis.expire(KEY(userId), TTL_SEC);
  return wasEmpty;
}

export async function removeSocket(userId: string, socketId: string): Promise<boolean> {
  await redis.srem(KEY(userId), socketId);
  const remaining = await redis.scard(KEY(userId));
  return remaining === 0;
}

export async function refreshPresence(userId: string): Promise<void> {
  await redis.expire(KEY(userId), TTL_SEC);
}

export async function getStatus(userId: string): Promise<PresenceStatus> {
  const n = await redis.scard(KEY(userId));
  return n > 0 ? 'online' : 'offline';
}

export async function getStatuses(userIds: string[]): Promise<Record<string, PresenceStatus>> {
  if (userIds.length === 0) return {};
  const pipeline = redis.pipeline();
  for (const id of userIds) pipeline.scard(KEY(id));
  const res = await pipeline.exec();
  const out: Record<string, PresenceStatus> = {};
  res?.forEach((entry, i) => {
    const [, count] = entry as [Error | null, number];
    const userId = userIds[i];
    if (userId) out[userId] = count > 0 ? 'online' : 'offline';
  });
  return out;
}
