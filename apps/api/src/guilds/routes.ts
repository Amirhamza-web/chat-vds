import type { FastifyInstance } from 'fastify';
import { CreateGuildSchema } from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';

export async function guildRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.post('/guilds', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const body = CreateGuildSchema.parse(req.body);
    const guild = await service.createGuild(req.userId, body);
    return reply.code(201).send(guild);
  });

  app.get('/guilds', async (req) => {
    if (!req.userId) throw Unauthorized();
    return service.listUserGuilds(req.userId);
  });

  app.get<{ Params: { id: string } }>('/guilds/:id', async (req) => {
    if (!req.userId) throw Unauthorized();
    return service.getGuild(req.userId, req.params.id);
  });

  app.get<{ Params: { id: string } }>('/guilds/:id/members', async (req) => {
    if (!req.userId) throw Unauthorized();
    return service.listMembers(req.userId, req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/guilds/:id', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    await service.deleteGuild(req.userId, req.params.id);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/guilds/:id/leave', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    await service.leaveGuild(req.userId, req.params.id);
    return reply.code(204).send();
  });
}
