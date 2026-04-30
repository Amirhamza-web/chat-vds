import type { FastifyInstance } from 'fastify';
import { CreateInviteSchema } from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';
import { broadcastGuildMemberAdd } from '../realtime/gateway.js';
import { prisma } from '../db/prisma.js';

export async function inviteRoutes(app: FastifyInstance): Promise<void> {
  app.post('/invites', { preHandler: app.requireAuth }, async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const body = CreateInviteSchema.parse(req.body);
    const invite = await service.createInvite(req.userId, body);
    return reply.code(201).send(invite);
  });

  app.get<{ Params: { code: string } }>('/invites/:code', async (req) => {
    return service.getInvite(req.params.code);
  });

  app.post<{ Params: { code: string } }>(
    '/invites/:code/accept',
    { preHandler: app.requireAuth },
    async (req) => {
      if (!req.userId) throw Unauthorized();
      const guild = await service.acceptInvite(req.userId, req.params.code);
      const member = await prisma.member.findUnique({
        where: { userId_guildId: { userId: req.userId, guildId: guild.id } },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });
      if (member) broadcastGuildMemberAdd(guild.id, member);
      return guild;
    },
  );
}
