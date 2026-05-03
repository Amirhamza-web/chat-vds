import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';
import { BadRequest, Unauthorized } from '../lib/errors.js';
import { getStorage } from './storage.js';

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post('/uploads', { preHandler: app.requireAuth }, async (req) => {
    if (!req.userId) throw Unauthorized();
    const file = await req.file();
    if (!file) throw BadRequest('No file provided');
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk as Buffer);
    }
    if (file.file.truncated) throw BadRequest('File too large');
    const { Readable } = await import('node:stream');
    const storage = getStorage();
    const stored = await storage.put(Readable.from(Buffer.concat(chunks)), file.filename, file.mimetype);
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
