import { Redis } from 'ioredis';
import { loadEnv } from './config.js';

const env = loadEnv();

let pub: Redis | null = null;

export function getRedisPublisher(): Redis {
  if (!pub) {
    pub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 5 });
    pub.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[sfu] redis error', err.message);
    });
  }
  return pub;
}

/**
 * Publish a snapshot of voice participants for a given channel so the API
 * gateway can fan it out to its Socket.IO clients in the guild room.
 */
export async function publishParticipants(payload: unknown): Promise<void> {
  const r = getRedisPublisher();
  await r.publish('voice:participants', JSON.stringify(payload));
}

export async function disconnectRedis(): Promise<void> {
  if (pub) {
    await pub.quit();
    pub = null;
  }
}
