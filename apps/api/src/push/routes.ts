import type { FastifyInstance } from 'fastify';
import { PushSubscribeSchema, PushUnsubscribeSchema } from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';

export async function pushRoutes(app: FastifyInstance): Promise<void> {
  // Public endpoint for VAPID public key (no auth required).
  app.get('/push/vapid-key', async () => {
    const key = service.getVapidPublicKey();
    return { vapidPublicKey: key };
  });

  app.post('/push/subscribe', { preHandler: app.requireAuth }, async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const body = PushSubscribeSchema.parse(req.body);
    await service.subscribe(req.userId, body);
    return reply.code(201).send({ ok: true });
  });

  app.post('/push/unsubscribe', { preHandler: app.requireAuth }, async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const body = PushUnsubscribeSchema.parse(req.body);
    await service.unsubscribe(req.userId, body.endpoint);
    return reply.code(204).send();
  });
}
