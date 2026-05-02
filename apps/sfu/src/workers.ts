import * as mediasoup from 'mediasoup';
import type { Worker, RtpCodecCapability } from 'mediasoup/types';
import { loadEnv } from './config.js';
import { log } from './log.js';

const env = loadEnv();

export const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    preferredPayloadType: 100,
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    preferredPayloadType: 101,
    clockRate: 90000,
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    preferredPayloadType: 102,
    clockRate: 90000,
    parameters: { 'profile-id': 2 },
  },
];

let workers: Worker[] = [];
let nextWorkerIdx = 0;

export async function startWorkers(): Promise<void> {
  const num = env.MEDIASOUP_NUM_WORKERS;
  log.info({ num }, 'starting mediasoup workers');
  for (let i = 0; i < num; i++) {
    const w = await mediasoup.createWorker({
      logLevel: env.MEDIASOUP_LOG_LEVEL,
      rtcMinPort: env.MEDIASOUP_RTC_MIN_PORT,
      rtcMaxPort: env.MEDIASOUP_RTC_MAX_PORT,
    });
    w.on('died', (err: Error) => {
      log.error({ err, pid: w.pid }, 'mediasoup worker died, exiting');
      setTimeout(() => process.exit(1), 1000);
    });
    workers.push(w);
  }
}

/** Round-robin worker for next router creation. */
export function nextWorker(): Worker {
  const w = workers[nextWorkerIdx % workers.length];
  if (!w) throw new Error('no mediasoup workers available');
  nextWorkerIdx++;
  return w;
}

export async function shutdownWorkers(): Promise<void> {
  for (const w of workers) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
  }
  workers = [];
}
