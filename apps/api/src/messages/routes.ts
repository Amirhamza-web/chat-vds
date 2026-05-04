import type { FastifyInstance } from 'fastify';
import {
  EditMessageSchema,
  MessageSearchSchema,
  SendMessageSchema,
} from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';
import {
  broadcastMessageDelete,
  broadcastMessageNew,
  broadcastMessageUpdate,
  broadcastPinUpdate,
  notifyMentions,
} from '../realtime/gateway.js';
import { sendMentionPush } from '../push/service.js';

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.post<{ Params: { channelId: string } }>(
    '/channels/:channelId/messages',
    async (req, reply) => {
      if (!req.userId) throw Unauthorized();
      const body = SendMessageSchema.parse(req.body);
      const { message, notifyTargets } = await service.sendMessage(
        req.userId,
        req.params.channelId,
        body,
      );
      broadcastMessageNew(message);
      if (notifyTargets.length > 0) {
        notifyMentions(notifyTargets, message);
        // Push notifications happen async — don't block the HTTP response.
        void sendMentionPush(notifyTargets, message).catch((err) =>
          app.log.warn({ err }, 'Failed to send mention push'),
        );
      }
      return reply.code(201).send(message);
    },
  );

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

  app.get<{ Params: { channelId: string } }>(
    '/channels/:channelId/pins',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      return service.listPinnedMessages(req.userId, req.params.channelId);
    },
  );

  app.patch<{ Params: { id: string } }>('/messages/:id', async (req) => {
    if (!req.userId) throw Unauthorized();
    const body = EditMessageSchema.parse(req.body);
    const updated = await service.editMessage(
      req.userId,
      req.params.id,
      body.content,
    );
    broadcastMessageUpdate(updated);
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/messages/:id', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const deleted = await service.deleteMessage(req.userId, req.params.id);
    broadcastMessageDelete(deleted);
    return reply.code(204).send();
  });

  app.put<{ Params: { id: string } }>('/messages/:id/pin', async (req) => {
    if (!req.userId) throw Unauthorized();
    const updated = await service.pinMessage(req.userId, req.params.id);
    broadcastMessageUpdate(updated);
    broadcastPinUpdate({
      channelId: updated.channelId,
      messageId: updated.id,
      pinned: true,
    });
    return updated;
  });

  app.delete<{ Params: { id: string } }>(
    '/messages/:id/pin',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      const updated = await service.unpinMessage(req.userId, req.params.id);
      broadcastMessageUpdate(updated);
      broadcastPinUpdate({
        channelId: updated.channelId,
        messageId: updated.id,
        pinned: false,
      });
      return updated;
    },
  );

  app.get('/messages/search', async (req) => {
    if (!req.userId) throw Unauthorized();
    const q = MessageSearchSchema.parse(req.query);
    return service.searchMessages(req.userId, q);
  });
}
