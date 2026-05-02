import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { loadEnv } from './config.js';
import { startWorkers, shutdownWorkers } from './workers.js';
import { attachSignaling } from './signaling.js';
import { disconnectRedis } from './redis.js';
import { log } from './log.js';

async function main() {
  const env = loadEnv();
  await startWorkers();

  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN.split(','), credentials: true },
    path: '/sfu',
  });
  attachSignaling(io);

  httpServer.listen(env.PORT, env.HOST, () => {
    log.info(
      {
        host: env.HOST,
        port: env.PORT,
        announcedIp: env.MEDIASOUP_ANNOUNCED_IP ?? '(unset – set MEDIASOUP_ANNOUNCED_IP for prod)',
        rtcRange: `${env.MEDIASOUP_RTC_MIN_PORT}-${env.MEDIASOUP_RTC_MAX_PORT}/udp+tcp`,
      },
      'sfu listening',
    );
  });

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
      log.info({ sig }, 'shutting down');
      io.close();
      httpServer.close();
      await shutdownWorkers();
      await disconnectRedis();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[sfu] fatal', err);
  process.exit(1);
});
