import type { FastifyInstance } from 'fastify';
import {
  AddDMRecipientSchema,
  CreateGroupDMSchema,
  OpenDMSchema,
} from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';

export async function dmRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  app.post('/dms', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const body = OpenDMSchema.parse(req.body);
    const dm = await service.openDM(req.userId, body);
    return reply.code(200).send(dm);
  });

  app.post('/dms/groups', async (req, reply) => {
    if (!req.userId) throw Unauthorized();
    const body = CreateGroupDMSchema.parse(req.body);
    const dm = await service.createGroupDM(req.userId, body);
    return reply.code(201).send(dm);
  });

  app.get('/dms', async (req) => {
    if (!req.userId) throw Unauthorized();
    return service.listDMs(req.userId);
  });

  app.get<{ Params: { channelId: string } }>(
    '/dms/:channelId',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      return service.getDMChannel(req.userId, req.params.channelId);
    },
  );

  app.post<{ Params: { channelId: string } }>(
    '/dms/:channelId/recipients',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      const body = AddDMRecipientSchema.parse(req.body);
      return service.addRecipient(
        req.userId,
        req.params.channelId,
        body.userId,
      );
    },
  );

  app.delete<{ Params: { channelId: string; userId: string } }>(
    '/dms/:channelId/recipients/:userId',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      return service.removeRecipient(
        req.userId,
        req.params.channelId,
        req.params.userId,
      );
    },
  );
}
