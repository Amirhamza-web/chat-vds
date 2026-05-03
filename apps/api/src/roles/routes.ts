import type { FastifyInstance } from 'fastify';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  SetMemberRolesSchema,
  PutOverwriteSchema,
} from '@chat-vds/shared';
import * as service from './service.js';
import { Unauthorized } from '../lib/errors.js';
import {
  broadcastRoleCreate,
  broadcastRoleUpdate,
  broadcastRoleDelete,
  broadcastMemberUpdate,
  broadcastChannelUpdate,
} from '../realtime/gateway.js';

export async function roleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireAuth);

  // ─── Roles CRUD ───
  app.get<{ Params: { guildId: string } }>(
    '/guilds/:guildId/roles',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      return service.listRoles(req.userId, req.params.guildId);
    },
  );

  app.post<{ Params: { guildId: string } }>(
    '/guilds/:guildId/roles',
    async (req, reply) => {
      if (!req.userId) throw Unauthorized();
      const body = CreateRoleSchema.parse(req.body);
      const role = await service.createRole(
        req.userId,
        req.params.guildId,
        body,
      );
      broadcastRoleCreate(role);
      return reply.code(201).send(role);
    },
  );

  app.patch<{ Params: { roleId: string } }>(
    '/roles/:roleId',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      const body = UpdateRoleSchema.parse(req.body);
      const role = await service.updateRole(req.userId, req.params.roleId, body);
      broadcastRoleUpdate(role);
      return role;
    },
  );

  app.delete<{ Params: { roleId: string } }>(
    '/roles/:roleId',
    async (req, reply) => {
      if (!req.userId) throw Unauthorized();
      const role = await service.deleteRole(req.userId, req.params.roleId);
      broadcastRoleDelete(role);
      return reply.code(204).send();
    },
  );

  // ─── Member role assignment ───
  app.put<{ Params: { guildId: string; memberId: string } }>(
    '/guilds/:guildId/members/:memberId/roles',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      const body = SetMemberRolesSchema.parse(req.body);
      const member = await service.setMemberRoles(
        req.userId,
        req.params.guildId,
        req.params.memberId,
        body,
      );
      broadcastMemberUpdate(req.params.guildId, member);
      return member;
    },
  );

  // ─── Permission overwrites ───
  app.get<{ Params: { channelId: string } }>(
    '/channels/:channelId/overwrites',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      return service.listOverwrites(req.userId, req.params.channelId);
    },
  );

  app.put<{ Params: { channelId: string } }>(
    '/channels/:channelId/overwrites',
    async (req) => {
      if (!req.userId) throw Unauthorized();
      const body = PutOverwriteSchema.parse(req.body);
      const ow = await service.putOverwrite(
        req.userId,
        req.params.channelId,
        body,
      );
      broadcastChannelUpdate(req.params.channelId);
      return ow;
    },
  );

  app.delete<{ Params: { channelId: string; overwriteId: string } }>(
    '/channels/:channelId/overwrites/:overwriteId',
    async (req, reply) => {
      if (!req.userId) throw Unauthorized();
      await service.deleteOverwrite(
        req.userId,
        req.params.channelId,
        req.params.overwriteId,
      );
      broadcastChannelUpdate(req.params.channelId);
      return reply.code(204).send();
    },
  );
}
