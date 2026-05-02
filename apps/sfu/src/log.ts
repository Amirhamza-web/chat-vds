import pino from 'pino';

export const log = pino({
  name: 'sfu',
  level: process.env.LOG_LEVEL ?? 'info',
});
