import type {
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
  RtpCapabilities,
  RtpParameters,
  DtlsParameters,
} from 'mediasoup/types';
import { loadEnv } from './config.js';
import { mediaCodecs, nextWorker } from './workers.js';
import { log } from './log.js';

const env = loadEnv();

export interface PeerInfo {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  micMuted: boolean;
  deafened: boolean;
}

interface PeerSession {
  socketId: string;
  info: PeerInfo;
  sendTransport?: WebRtcTransport;
  recvTransport?: WebRtcTransport;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

/**
 * Per-channel room. Lazily created when the first peer joins; closed when the
 * last peer leaves. Holds a single mediasoup Router and tracks peers + their
 * transports/producers/consumers.
 */
export class VoiceRoom {
  readonly channelId: string;
  readonly guildId: string | null;
  readonly router: Router;
  private peers = new Map<string, PeerSession>(); // keyed by userId

  private constructor(channelId: string, guildId: string | null, router: Router) {
    this.channelId = channelId;
    this.guildId = guildId;
    this.router = router;
  }

  static async create(channelId: string, guildId: string | null): Promise<VoiceRoom> {
    const worker = nextWorker();
    const router = await worker.createRouter({ mediaCodecs });
    log.info({ channelId, routerId: router.id }, 'voice room created');
    return new VoiceRoom(channelId, guildId, router);
  }

  isEmpty(): boolean {
    return this.peers.size === 0;
  }

  hasPeer(userId: string): boolean {
    return this.peers.has(userId);
  }

  listPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).map((p) => p.info);
  }

  getPeer(userId: string): PeerSession | undefined {
    return this.peers.get(userId);
  }

  addPeer(socketId: string, info: PeerInfo): PeerSession {
    const peer: PeerSession = {
      socketId,
      info,
      producers: new Map(),
      consumers: new Map(),
    };
    this.peers.set(info.userId, peer);
    return peer;
  }

  /** All other peers' producers — used when a new peer joins so it can subscribe. */
  otherProducers(userId: string): { peerId: string; producerId: string; kind: 'audio' | 'video' }[] {
    const out: { peerId: string; producerId: string; kind: 'audio' | 'video' }[] = [];
    for (const [otherId, peer] of this.peers) {
      if (otherId === userId) continue;
      for (const p of peer.producers.values()) {
        out.push({ peerId: otherId, producerId: p.id, kind: p.kind as 'audio' | 'video' });
      }
    }
    return out;
  }

  async createWebRtcTransport(): Promise<WebRtcTransport> {
    return this.router.createWebRtcTransport({
      listenIps: [
        {
          ip: env.MEDIASOUP_LISTEN_IP,
          announcedIp: env.MEDIASOUP_ANNOUNCED_IP,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 800_000,
    });
  }

  removePeer(userId: string): PeerSession | undefined {
    const p = this.peers.get(userId);
    if (!p) return undefined;
    for (const c of p.consumers.values()) {
      try { c.close(); } catch { /* ignore */ }
    }
    for (const prod of p.producers.values()) {
      try { prod.close(); } catch { /* ignore */ }
    }
    try { p.sendTransport?.close(); } catch { /* ignore */ }
    try { p.recvTransport?.close(); } catch { /* ignore */ }
    this.peers.delete(userId);
    return p;
  }

  close(): void {
    for (const userId of Array.from(this.peers.keys())) this.removePeer(userId);
    try { this.router.close(); } catch { /* ignore */ }
    log.info({ channelId: this.channelId }, 'voice room closed');
  }
}

export type {
  RtpCapabilities,
  RtpParameters,
  DtlsParameters,
};
