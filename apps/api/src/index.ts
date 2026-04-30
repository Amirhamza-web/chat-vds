import { loadEnv } from './config/env.js';
import { buildServer } from './server.js';
import { attachSocketIO } from './realtime/gateway.js';

async function main() {
  const env = loadEnv();
  const app = await buildServer();
  attachSocketIO(app.server);

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info(`API listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
