import type { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  DtlsParameters,
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup/types';
import { VoiceEvents, type VoiceParticipantsPayload, type ProducerSource } from '@chat-vds/shared';
import { verifyAccessToken } from './auth.js';
import { prisma } from './prisma.js';
import { deleteRoom, getOrCreateRoom, getRoom } from './rooms-registry.js';
import type { PeerInfo, VoiceRoom } from './room.js';
import { publishParticipants } from './redis.js';
import { log } from './log.js';

interface SocketData {
  userId: string;
  username: string;
  channelId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ack = (resp: any) => void;
type SfuSocket = Socket<any, any, any, SocketData>;

export function attachSignaling(io: SocketIOServer): void {
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice(7)
        : undefined);
    if (!token) return next(new Error('Unauthorized'));
    const payload = verifyAccessToken(token);
    if (!payload) return next(new Error('Unauthorized'));
    socket.data.userId = payload.sub;
    socket.data.username = payload.username;
    next();
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as SfuSocket;
    log.info({ userId: socket.data.userId }, 'sfu socket connected');

    socket.on(VoiceEvents.Join, async (payload: { channelId?: string } | undefined, cb?: Ack) => {
      try {
        const channelId = payload?.channelId;
        if (!channelId) return cb?.({ error: 'channelId required' });
        await handleJoin(socket, channelId, cb);
      } catch (err) {
        log.error({ err }, 'voice:join failed');
        cb?.({ error: 'internal error' });
      }
    });

    socket.on(
      VoiceEvents.CreateTransport,
      async (payload: { direction?: 'send' | 'recv' } | undefined, cb?: Ack) => {
        try {
          const direction = payload?.direction;
          const room = currentRoom(socket);
          if (!room) return cb?.({ error: 'not in a voice channel' });
          const peer = room.getPeer(socket.data.userId);
          if (!peer) return cb?.({ error: 'peer not registered' });
          const transport = await room.createWebRtcTransport();
          if (direction === 'send') peer.sendTransport = transport;
          else peer.recvTransport = transport;
          cb?.({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          });
        } catch (err) {
          log.error({ err }, 'voice:create-transport failed');
          cb?.({ error: 'internal error' });
        }
      },
    );

    socket.on(
      VoiceEvents.ConnectTransport,
      async (
        payload: { transportId: string; dtlsParameters: DtlsParameters },
        cb?: Ack,
      ) => {
        try {
          const room = currentRoom(socket);
          const peer = room?.getPeer(socket.data.userId);
          if (!peer) return cb?.({ error: 'peer not registered' });
          const transport =
            peer.sendTransport?.id === payload.transportId
              ? peer.sendTransport
              : peer.recvTransport?.id === payload.transportId
                ? peer.recvTransport
                : undefined;
          if (!transport) return cb?.({ error: 'transport not found' });
          await transport.connect({ dtlsParameters: payload.dtlsParameters });
          cb?.({ ok: true });
        } catch (err) {
          log.error({ err }, 'voice:connect-transport failed');
          cb?.({ error: 'internal error' });
        }
      },
    );

    socket.on(
      VoiceEvents.Produce,
      async (
        payload: { kind: 'audio' | 'video'; rtpParameters: RtpParameters; source?: ProducerSource },
        cb?: Ack,
      ) => {
        try {
          const room = currentRoom(socket);
          const peer = room?.getPeer(socket.data.userId);
          if (!room || !peer || !peer.sendTransport) {
            return cb?.({ error: 'no send transport' });
          }
          const source: ProducerSource = payload.source ?? (payload.kind === 'audio' ? 'mic' : 'camera');
          const producer = await peer.sendTransport.produce({
            kind: payload.kind,
            rtpParameters: payload.rtpParameters,
            appData: { source },
          });
          peer.producers.set(producer.id, producer);
          producer.on('transportclose', () => producer.close());

          if (source === 'camera') peer.info.cameraOn = true;
          else if (source === 'screen') peer.info.screenSharing = true;

          socket
            .to(roomId(room.channelId))
            .emit(VoiceEvents.NewProducer, {
              peerId: socket.data.userId,
              producerId: producer.id,
              kind: producer.kind,
              source,
            });
          if (source === 'camera' || source === 'screen') {
            socket.to(roomId(room.channelId)).emit(VoiceEvents.PeerStateUpdate, {
              userId: peer.info.userId,
              micMuted: peer.info.micMuted,
              deafened: peer.info.deafened,
              cameraOn: peer.info.cameraOn,
              screenSharing: peer.info.screenSharing,
            });
            await broadcastParticipantsSnapshot(room);
          }
          cb?.({ id: producer.id });
        } catch (err) {
          log.error({ err }, 'voice:produce failed');
          cb?.({ error: 'internal error' });
        }
      },
    );

    socket.on(
      VoiceEvents.Consume,
      async (
        payload: { producerId: string; rtpCapabilities: RtpCapabilities },
        cb?: Ack,
      ) => {
        try {
          const room = currentRoom(socket);
          const peer = room?.getPeer(socket.data.userId);
          if (!room || !peer || !peer.recvTransport) {
            return cb?.({ error: 'no recv transport' });
          }
          if (!room.router.canConsume({
            producerId: payload.producerId,
            rtpCapabilities: payload.rtpCapabilities,
          })) {
            return cb?.({ error: 'cannot consume' });
          }
          const producerSource = room.findProducerSource(payload.producerId);
          const consumer = await peer.recvTransport.consume({
            producerId: payload.producerId,
            rtpCapabilities: payload.rtpCapabilities,
            paused: true,
            appData: { source: producerSource },
          });
          peer.consumers.set(consumer.id, consumer);
          consumer.on('transportclose', () => consumer.close());
          consumer.on('producerclose', () => {
            peer.consumers.delete(consumer.id);
            socket.emit(VoiceEvents.ProducerClosed, { consumerId: consumer.id });
          });
          cb?.({
            id: consumer.id,
            producerId: payload.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            source: producerSource,
          });
        } catch (err) {
          log.error({ err }, 'voice:consume failed');
          cb?.({ error: 'internal error' });
        }
      },
    );

    socket.on(
      VoiceEvents.ResumeConsumer,
      async (payload: { consumerId: string }, cb?: Ack) => {
        try {
          const peer = currentRoom(socket)?.getPeer(socket.data.userId);
          const consumer = peer?.consumers.get(payload.consumerId);
          if (!consumer) return cb?.({ error: 'consumer not found' });
          await consumer.resume();
          cb?.({ ok: true });
        } catch (err) {
          log.error({ err }, 'voice:resume-consumer failed');
          cb?.({ error: 'internal error' });
        }
      },
    );

    socket.on(
      VoiceEvents.CloseProducer,
      async (payload: { producerId: string }, cb?: Ack) => {
        try {
          const room = currentRoom(socket);
          const peer = room?.getPeer(socket.data.userId);
          if (!room || !peer) return cb?.({ error: 'peer not found' });
          const producer = peer.producers.get(payload.producerId);
          if (!producer) return cb?.({ error: 'producer not found' });
          const source = (producer.appData.source as ProducerSource | undefined) ?? 'mic';
          producer.close();
          peer.producers.delete(payload.producerId);
          if (source === 'camera') peer.info.cameraOn = false;
          else if (source === 'screen') peer.info.screenSharing = false;
          if (source === 'camera' || source === 'screen') {
            socket.to(roomId(room.channelId)).emit(VoiceEvents.PeerStateUpdate, {
              userId: peer.info.userId,
              micMuted: peer.info.micMuted,
              deafened: peer.info.deafened,
              cameraOn: peer.info.cameraOn,
              screenSharing: peer.info.screenSharing,
            });
            await broadcastParticipantsSnapshot(room);
          }
          cb?.({ ok: true });
        } catch (err) {
          log.error({ err }, 'voice:close-producer failed');
          cb?.({ error: 'internal error' });
        }
      },
    );

    socket.on(
      VoiceEvents.StateUpdate,
      async (payload: { micMuted?: boolean; deafened?: boolean; cameraOn?: boolean; screenSharing?: boolean }) => {
        const room = currentRoom(socket);
        const peer = room?.getPeer(socket.data.userId);
        if (!peer || !room) return;
        if (typeof payload?.micMuted === 'boolean') peer.info.micMuted = payload.micMuted;
        if (typeof payload?.deafened === 'boolean') peer.info.deafened = payload.deafened;
        if (typeof payload?.cameraOn === 'boolean') peer.info.cameraOn = payload.cameraOn;
        if (typeof payload?.screenSharing === 'boolean') peer.info.screenSharing = payload.screenSharing;
        socket.to(roomId(room.channelId)).emit(VoiceEvents.PeerStateUpdate, {
          userId: peer.info.userId,
          micMuted: peer.info.micMuted,
          deafened: peer.info.deafened,
          cameraOn: peer.info.cameraOn,
          screenSharing: peer.info.screenSharing,
        });
        await broadcastParticipantsSnapshot(room);
      },
    );

    socket.on(VoiceEvents.Leave, async (_payload: unknown, cb?: Ack) => {
      await handleLeave(socket);
      cb?.({ ok: true });
    });

    socket.on('disconnect', async () => {
      await handleLeave(socket);
      log.info({ userId: socket.data.userId }, 'sfu socket disconnected');
    });
  });
}

async function handleJoin(
  socket: SfuSocket,
  channelId: string,
  cb?: Ack,
): Promise<void> {
  const userId = socket.data.userId;

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return cb?.({ error: 'channel not found' });
  if (channel.type !== 'VOICE') return cb?.({ error: 'not a voice channel' });
  if (channel.guildId) {
    const m = await prisma.member.findUnique({
      where: { userId_guildId: { userId, guildId: channel.guildId } },
    });
    if (!m) return cb?.({ error: 'not a member' });
  }

  if (socket.data.channelId && socket.data.channelId !== channelId) {
    await handleLeave(socket);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return cb?.({ error: 'user not found' });

  const room = await getOrCreateRoom(channelId, channel.guildId);
  const info: PeerInfo = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    micMuted: false,
    deafened: false,
    cameraOn: false,
    screenSharing: false,
  };
  room.addPeer(socket.id, info);
  socket.data.channelId = channelId;
  await socket.join(roomId(channelId));

  cb?.({
    rtpCapabilities: room.router.rtpCapabilities,
    peers: room.listPeers().filter((p) => p.userId !== userId),
    existingProducers: room.otherProducers(userId),
  });

  socket.to(roomId(channelId)).emit(VoiceEvents.PeerJoined, info);
  await broadcastParticipantsSnapshot(room);
}

async function handleLeave(socket: SfuSocket): Promise<void> {
  const channelId = socket.data.channelId;
  if (!channelId) return;
  const room = getRoom(channelId);
  socket.data.channelId = undefined;
  if (!room) return;
  const peer = room.getPeer(socket.data.userId);
  await socket.leave(roomId(channelId));
  room.removePeer(socket.data.userId);
  if (peer) {
    socket.to(roomId(channelId)).emit(VoiceEvents.PeerLeft, { userId: peer.info.userId });
  }
  if (room.isEmpty()) {
    deleteRoom(channelId);
  }
  await broadcastParticipantsSnapshot(room);
}

function currentRoom(socket: SfuSocket): VoiceRoom | undefined {
  const id = socket.data.channelId;
  if (!id) return undefined;
  return getRoom(id);
}

function roomId(channelId: string): string {
  return `voice:${channelId}`;
}

async function broadcastParticipantsSnapshot(room: VoiceRoom): Promise<void> {
  const payload: VoiceParticipantsPayload = {
    channelId: room.channelId,
    guildId: room.guildId,
    participants: room.listPeers(),
  };
  await publishParticipants(payload);
}
