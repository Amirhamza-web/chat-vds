import type { FastifyInstance } from 'fastify';
import { CreateChannelSchema } from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';
import { broadcastChannelCreate, broadcastChannelDelete } from '../realtime/gateway.js';

export async function channelRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.post<{ Params: { guildId: string } }>('/guilds/:guildId/channels', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const body = CreateChannelSchema.parse(req.body);
    const channel = await service.createChannel(req.userId, req.params.guildId, body);
    broadcastChannelCreate(channel);
    return reply.code(201).send(channel);
  });

  app.get<{ Params: { guildId: string } }>('/guilds/:guildId/channels', async (req) => {
    if (!req.userId) throw Unauthorized();
    return service.listChannels(req.userId, req.params.guildId);
  });

  app.delete<{ Params: { id: string } }>('/channels/:id', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const channel = await service.deleteChannel(req.userId, req.params.id);
    broadcastChannelDelete(channel);
    return reply.code(204).send();
  });
}
