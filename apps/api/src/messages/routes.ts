import type { FastifyInstance } from 'fastify';
import { EditMessageSchema, SendMessageSchema } from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';
import {
  broadcastMessageDelete,
  broadcastMessageNew,
  broadcastMessageUpdate,
} from '../realtime/gateway.js';

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.post<{ Params: { channelId: string } }>('/channels/:channelId/messages', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const body = SendMessageSchema.parse(req.body);
    const message = await service.sendMessage(req.userId, req.params.channelId, body);
    broadcastMessageNew(message);
    return reply.code(201).send(message);
  });

  app.get<{
    Params: { channelId: string };
    Querystring: { before?: string; limit?: string };
  }>('/channels/:channelId/messages', async (req) => {
    if (!req.userId) throw Unauthorized();
    return service.listMessages(req.userId, req.params.channelId, {
      before: req.query.before,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
  });

  app.patch<{ Params: { id: string } }>('/messages/:id', async (req) => {
    if (!req.userId) throw Unauthorized();
    const body = EditMessageSchema.parse(req.body);
    const updated = await service.editMessage(req.userId, req.params.id, body.content);
    broadcastMessageUpdate(updated);
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/messages/:id', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const deleted = await service.deleteMessage(req.userId, req.params.id);
    broadcastMessageDelete(deleted);
    return reply.code(204).send();
  });
}
