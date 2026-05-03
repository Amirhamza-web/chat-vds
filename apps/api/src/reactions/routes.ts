import type { FastifyInstance } from 'fastify';
import { AddReactionSchema } from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';
import {
  broadcastReactionAdd,
  broadcastReactionRemove,
} from '../realtime/gateway.js';

export async function reactionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.put<{ Params: { messageId: string } }>(
    '/messages/:messageId/reactions',
    async (req, reply) => {
      if (!req.userId) throw Unauthorized();
      const body = AddReactionSchema.parse(req.body);
      const result = await service.addReaction(
        req.userId,
        req.params.messageId,
        body,
      );
      broadcastReactionAdd(result);
      return reply.code(201).send(result);
    },
  );

  app.delete<{ Params: { messageId: string; emoji: string } }>(
    '/messages/:messageId/reactions/:emoji',
    async (req, reply) => {
      if (!req.userId) throw Unauthorized();
      const result = await service.removeReaction(
        req.userId,
        req.params.messageId,
        decodeURIComponent(req.params.emoji),
      );
      broadcastReactionRemove(result);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { messageId: string } }>(
    '/messages/:messageId/reactions',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      return service.listReactions(req.userId, req.params.messageId);
    },
  );
}
