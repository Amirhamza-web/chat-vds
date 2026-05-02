import { Device } from 'mediasoup-client';
import type {
  Transport,
  Producer,
  Consumer,
  RtpCapabilities,
} from 'mediasoup-client/types';
import { io, Socket } from 'socket.io-client';
import { VoiceEvents, type VoicePeerDto } from '@chat-vds/shared';
import { useAuthStore } from './store';

const SFU_URL = import.meta.env.VITE_SFU_URL ?? 'http://localhost:3002';

interface JoinResponse {
  rtpCapabilities: RtpCapabilities;
  peers: VoicePeerDto[];
  existingProducers: { peerId: string; producerId: string; kind: 'audio' | 'video' }[];
  error?: string;
}

interface TransportInfo {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown[];
  dtlsParameters: unknown;
  error?: string;
}

interface NewProducerEvent {
  peerId: string;
  producerId: string;
  kind: 'audio' | 'video';
}

interface PeerStateUpdate {
  userId: string;
  micMuted: boolean;
  deafened: boolean;
}

export interface VoiceClientHandlers {
  onPeerJoined: (peer: VoicePeerDto) => void;
  onPeerLeft: (userId: string) => void;
  onPeerStateUpdate: (state: PeerStateUpdate) => void;
  /** Called when a remote producer is available; receiver wires audio element. */
  onRemoteAudio: (peerId: string, track: MediaStreamTrack) => void;
  /** Called when a remote producer is closed (peer muted/disconnected). */
  onRemoteAudioRemoved: (peerId: string) => void;
  onError: (msg: string) => void;
}

export class VoiceClient {
  private socket: Socket | null = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private micProducer: Producer | null = null;
  private consumers = new Map<string, Consumer>(); // consumerId -> Consumer
  private localStream: MediaStream | null = null;

  constructor(private handlers: VoiceClientHandlers) {}

  async connect(): Promise<void> {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw new Error('not authenticated');
    if (this.socket?.connected) return;
    this.socket = io(SFU_URL, {
      path: '/sfu',
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
    });
    await new Promise<void>((resolve, reject) => {
      const s = this.socket!;
      const onConnect = () => {
        s.off('connect_error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        s.off('connect', onConnect);
        reject(err);
      };
      s.once('connect', onConnect);
      s.once('connect_error', onError);
    });
    this.attachServerEvents();
  }

  private attachServerEvents() {
    const s = this.socket!;
    s.on(VoiceEvents.PeerJoined, (peer: VoicePeerDto) => this.handlers.onPeerJoined(peer));
    s.on(VoiceEvents.PeerLeft, ({ userId }: { userId: string }) =>
      this.handlers.onPeerLeft(userId),
    );
    s.on(VoiceEvents.PeerStateUpdate, (st: PeerStateUpdate) =>
      this.handlers.onPeerStateUpdate(st),
    );
    s.on(VoiceEvents.NewProducer, async (e: NewProducerEvent) => {
      try {
        await this.consumeRemote(e.peerId, e.producerId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[voice] consumeRemote', err);
      }
    });
    s.on(VoiceEvents.ProducerClosed, ({ consumerId }: { consumerId: string }) => {
      const c = this.consumers.get(consumerId);
      if (c) {
        c.close();
        this.consumers.delete(consumerId);
        this.handlers.onRemoteAudioRemoved(c.appData.peerId as string);
      }
    });
  }

  async join(channelId: string): Promise<VoicePeerDto[]> {
    if (!this.socket) throw new Error('not connected');
    const resp = await this.emit<JoinResponse>(VoiceEvents.Join, { channelId });
    if (resp.error) throw new Error(resp.error);

    this.device = new Device();
    await this.device.load({ routerRtpCapabilities: resp.rtpCapabilities });

    await this.createSendTransport();
    await this.createRecvTransport();
    await this.startMicProducer();

    // Subscribe to existing producers (peers already in room).
    for (const ep of resp.existingProducers) {
      try {
        await this.consumeRemote(ep.peerId, ep.producerId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[voice] initial consume', err);
      }
    }
    return resp.peers;
  }

  private async createSendTransport(): Promise<void> {
    const info = await this.emit<TransportInfo>(VoiceEvents.CreateTransport, {
      direction: 'send',
    });
    if (info.error) throw new Error(info.error);
    const t = this.device!.createSendTransport(info as never);
    t.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.emit(VoiceEvents.ConnectTransport, {
        transportId: t.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });
    t.on('produce', ({ kind, rtpParameters }, callback, errback) => {
      this.emit<{ id: string; error?: string }>(VoiceEvents.Produce, {
        kind,
        rtpParameters,
      })
        .then((r) => (r.error ? errback(new Error(r.error)) : callback({ id: r.id })))
        .catch(errback);
    });
    this.sendTransport = t;
  }

  private async createRecvTransport(): Promise<void> {
    const info = await this.emit<TransportInfo>(VoiceEvents.CreateTransport, {
      direction: 'recv',
    });
    if (info.error) throw new Error(info.error);
    const t = this.device!.createRecvTransport(info as never);
    t.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.emit(VoiceEvents.ConnectTransport, {
        transportId: t.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });
    this.recvTransport = t;
  }

  private async startMicProducer(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const track = this.localStream.getAudioTracks()[0];
    if (!track) throw new Error('no microphone track');
    this.micProducer = await this.sendTransport!.produce({
      track,
      codecOptions: { opusStereo: false, opusDtx: true },
    });
  }

  private async consumeRemote(peerId: string, producerId: string): Promise<void> {
    if (!this.recvTransport || !this.device) return;
    const resp = await this.emit<{
      id: string;
      kind: 'audio' | 'video';
      rtpParameters: never;
      error?: string;
    }>(VoiceEvents.Consume, {
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
    if (resp.error) throw new Error(resp.error);
    const consumer = await this.recvTransport.consume({
      id: resp.id,
      producerId,
      kind: resp.kind,
      rtpParameters: resp.rtpParameters,
      appData: { peerId },
    });
    this.consumers.set(consumer.id, consumer);
    await this.emit(VoiceEvents.ResumeConsumer, { consumerId: consumer.id });
    if (consumer.kind === 'audio') {
      this.handlers.onRemoteAudio(peerId, consumer.track);
    }
  }

  setMicMuted(muted: boolean): void {
    if (!this.micProducer) return;
    if (muted) this.micProducer.pause();
    else this.micProducer.resume();
    void this.emit(VoiceEvents.StateUpdate, { micMuted: muted });
  }

  setDeafened(deafened: boolean): void {
    for (const c of this.consumers.values()) {
      try {
        if (deafened) c.pause();
        else c.resume();
      } catch {
        /* ignore */
      }
    }
    void this.emit(VoiceEvents.StateUpdate, { deafened });
  }

  async leave(): Promise<void> {
    try {
      await this.emit(VoiceEvents.Leave, {});
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  private cleanup(): void {
    for (const c of this.consumers.values()) {
      try { c.close(); } catch { /* ignore */ }
    }
    this.consumers.clear();
    try { this.micProducer?.close(); } catch { /* ignore */ }
    this.micProducer = null;
    try { this.sendTransport?.close(); } catch { /* ignore */ }
    try { this.recvTransport?.close(); } catch { /* ignore */ }
    this.sendTransport = null;
    this.recvTransport = null;
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }
    this.device = null;
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Promise-wrapped Socket.IO emit-with-ack. */
  private emit<T = unknown>(event: string, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('not connected'));
      this.socket.emit(event, payload, (resp: T) => resolve(resp));
      setTimeout(() => reject(new Error(`emit ${event} timed out`)), 15_000);
    });
  }

  getLocalAudioTrack(): MediaStreamTrack | null {
    return this.localStream?.getAudioTracks()[0] ?? null;
  }
}
