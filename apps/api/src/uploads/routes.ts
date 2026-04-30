import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';
import { BadRequest, Unauthorized } from '../lib/errors.js';
import { getStorage } from './storage.js';

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post('/uploads', { preHandler: app.requireAuth }, async (req) => {
    if (!req.userId) throw Unauthorized();
    const file = await req.file();
    if (!file) throw BadRequest('No file provided');
    const storage = getStorage();
    const stored = await storage.put(file.file, file.filename, file.mimetype);
    if (file.file.truncated) throw BadRequest('File too large');
    const attachment = await prisma.attachment.create({
      data: {
        uploaderId: req.userId,
        url: stored.url,
        filename: file.filename,
        size: stored.size,
        mimeType: file.mimetype,
      },
    });
    return attachment;
  });
}
