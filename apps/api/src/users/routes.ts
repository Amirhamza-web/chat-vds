import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';
import { Unauthorized } from '../lib/errors.js';
import { publicUserSelect } from '../auth/service.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users/me', { preHandler: app.requireAuth }, async (req) => {
    if (!req.userId) throw Unauthorized();
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: publicUserSelect,
    });
    return user;
  });
}
