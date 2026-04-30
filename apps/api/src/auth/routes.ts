import type { FastifyInstance } from 'fastify';
import { LoginSchema, RefreshSchema, RegisterSchema } from '@chat-vds/shared';
import * as service from './service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (req, reply) => {
    const body = RegisterSchema.parse(req.body);
    const result = await service.register(body);
    return reply.code(201).send(result);
  });

  app.post('/auth/login', async (req) => {
    const body = LoginSchema.parse(req.body);
    return service.login(body);
  });

  app.post('/auth/refresh', async (req) => {
    const body = RefreshSchema.parse(req.body);
    return service.refresh(body.refreshToken);
  });

  app.post('/auth/logout', async (req, reply) => {
    const body = RefreshSchema.parse(req.body);
    await service.logout(body.refreshToken);
    return reply.code(204).send();
  });
}
