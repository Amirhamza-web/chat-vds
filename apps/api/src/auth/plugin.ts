import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccessToken } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    username?: string;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const payload = verifyAccessToken(token);
      if (payload) {
        req.userId = payload.sub;
        req.username = payload.username;
      }
    }
  });

  app.decorate('requireAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
