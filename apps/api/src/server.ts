import path from 'node:path';
import fs from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { ZodError } from 'zod';
import { loadEnv } from './config/env.js';
import { authPlugin } from './auth/plugin.js';
import { authRoutes } from './auth/routes.js';
import { userRoutes } from './users/routes.js';
import { guildRoutes } from './guilds/routes.js';
import { channelRoutes } from './channels/routes.js';
import { messageRoutes } from './messages/routes.js';
import { inviteRoutes } from './invites/routes.js';
import { uploadRoutes } from './uploads/routes.js';
import { roleRoutes } from './roles/routes.js';
import { reactionRoutes } from './reactions/routes.js';
import { dmRoutes } from './dms/routes.js';
import { pushRoutes } from './push/routes.js';
import { HttpError } from './lib/errors.js';

export async function buildServer(): Promise<FastifyInstance> {
  const env = loadEnv();
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  });

  if (env.STORAGE_DRIVER === 'local') {
    const dir = path.resolve(env.UPLOAD_DIR);
    fs.mkdirSync(dir, { recursive: true });
    await app.register(staticPlugin, {
      root: dir,
      prefix: '/uploads/',
      decorateReply: false,
    });
  }

  await app.register(authPlugin);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      reply.code(400).send({ error: 'ValidationError', issues: err.flatten() });
      return;
    }
    if (err instanceof HttpError) {
      reply.code(err.statusCode).send({ error: err.message, code: err.code });
      return;
    }
    app.log.error({ err }, 'Unhandled error');
    reply.code(500).send({ error: 'Internal Server Error' });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(guildRoutes, { prefix: '/api/v1' });
  await app.register(channelRoutes, { prefix: '/api/v1' });
  await app.register(messageRoutes, { prefix: '/api/v1' });
  await app.register(inviteRoutes, { prefix: '/api/v1' });
  await app.register(uploadRoutes, { prefix: '/api/v1' });
  await app.register(roleRoutes, { prefix: '/api/v1' });
  await app.register(reactionRoutes, { prefix: '/api/v1' });
  await app.register(dmRoutes, { prefix: '/api/v1' });
  await app.register(pushRoutes, { prefix: '/api/v1' });

  return app;
}
