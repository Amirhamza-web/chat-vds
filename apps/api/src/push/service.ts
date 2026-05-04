import webpush from 'web-push';
import type { PushSubscribeInput } from '@chat-vds/shared';
import { prisma } from '../db/prisma.js';
import { loadEnv } from '../config/env.js';
import { NotFound } from '../lib/errors.js';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const env = loadEnv();
  const pub = env.VAPID_PUBLIC_KEY;
  const priv = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return; // push disabled
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
}

export async function subscribe(userId: string, input: PushSubscribeInput) {
  ensureVapid();
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    },
    update: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth },
  });
}

export async function unsubscribe(userId: string, endpoint: string) {
  const sub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (!sub) throw NotFound('Subscription not found');
  if (sub.userId !== userId) throw NotFound('Subscription not found');
  await prisma.pushSubscription.delete({ where: { id: sub.id } });
}

export function getVapidPublicKey(): string | null {
  const env = loadEnv();
  return env.VAPID_PUBLIC_KEY || null;
}

export async function sendMentionPush(
  targetUserIds: string[],
  message: { channelId: string; authorId: string; content: string; id: string; author: { displayName: string } },
) {
  ensureVapid();
  if (!vapidConfigured) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: targetUserIds } },
  });
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: `@${message.author.displayName}`,
    body: message.content.slice(0, 200),
    data: { channelId: message.channelId, messageId: message.id },
  });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payload,
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
          throw err;
        }),
    ),
  );

  return results;
}
