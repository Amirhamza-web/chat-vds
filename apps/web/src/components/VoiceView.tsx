import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import type { VoicePeerDto } from '@chat-vds/shared';
import { VoiceClient } from '../lib/voice';
import { useVoiceStore, videoTrackKey } from '../lib/voice-store';
import { useAuthStore } from '../lib/store';

interface Props {
  channelId: string;
  channelName: string;
}

export default function VoiceView({ channelId, channelName }: Props) {
  const me = useAuthStore((s) => s.user);
  const peers = useVoiceStore((s) => s.peers);
  const micMuted = useVoiceStore((s) => s.micMuted);
  const deafened = useVoiceStore((s) => s.deafened);
  const cameraOn = useVoiceStore((s) => s.cameraOn);
  const screenSharing = useVoiceStore((s) => s.screenSharing);
  const connecting = useVoiceStore((s) => s.connecting);
  const error = useVoiceStore((s) => s.error);
  const activeChannelId = useVoiceStore((s) => s.channelId);
  const videoTracks = useVoiceStore((s) => s.videoTracks);
  const setConnecting = useVoiceStore((s) => s.setConnecting);
  const setError = useVoiceStore((s) => s.setError);
  const setActiveChannel = useVoiceStore((s) => s.setActiveChannel);
  const resetChannel = useVoiceStore((s) => s.resetChannel);
  const setPeers = useVoiceStore((s) => s.setPeers);
  const upsertPeer = useVoiceStore((s) => s.upsertPeer);
  const removePeer = useVoiceStore((s) => s.removePeer);
  const setPeerState = useVoiceStore((s) => s.setPeerState);
  const setMicMuted = useVoiceStore((s) => s.setMicMuted);
  const setDeafened = useVoiceStore((s) => s.setDeafened);
  const setCameraOn = useVoiceStore((s) => s.setCameraOn);
  const setScreenSharing = useVoiceStore((s) => s.setScreenSharing);
  const setVideoTrack = useVoiceStore((s) => s.setVideoTrack);
  const removeVideoTrack = useVoiceStore((s) => s.removeVideoTrack);

  const clientRef = useRef<VoiceClient | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());

  const inThisChannel = activeChannelId === channelId;

  const connect = async () => {
    if (clientRef.current) return;
    setConnecting(true);
    setError(null);
    const client = new VoiceClient({
      onPeerJoined: (peer) => upsertPeer(peer),
      onPeerLeft: (uid) => {
        removePeer(uid);
        const el = audioRefs.current.get(uid);
        if (el) {
          el.srcObject = null;
          audioRefs.current.delete(uid);
        }
      },
      onPeerStateUpdate: ({ userId, micMuted, deafened, cameraOn, screenSharing }) =>
        setPeerState(userId, { micMuted, deafened, cameraOn, screenSharing }),
      onRemoteAudio: (peerId, track) => {
        let el = audioRefs.current.get(peerId);
        if (!el) {
          el = document.createElement('audio');
          el.autoplay = true;
          el.dataset.peerId = peerId;
          el.style.display = 'none';
          document.body.appendChild(el);
          audioRefs.current.set(peerId, el);
        }
        const stream = new MediaStream([track]);
        el.srcObject = stream;
        attachVoiceActivity(stream, peerId, setSpeaking);
      },
      onRemoteAudioRemoved: (peerId) => {
        const el = audioRefs.current.get(peerId);
        if (el) el.srcObject = null;
      },
      onRemoteVideo: (peerId, track, source) => {
        setVideoTrack(videoTrackKey(peerId, source), track);
      },
      onRemoteVideoRemoved: (peerId, source) => {
        removeVideoTrack(videoTrackKey(peerId, source));
      },
      onError: (msg) => setError(msg),
    });
    clientRef.current = client;
    try {
      await client.connect();
      const initialPeers = await client.join(channelId);
      const self: VoicePeerDto | null = me
        ? {
            userId: me.id,
            username: me.username,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
            micMuted: false,
            deafened: false,
            cameraOn: false,
            screenSharing: false,
          }
        : null;
      setPeers(self ? [self, ...initialPeers] : initialPeers);
      setActiveChannel(channelId, channelName);
      setMicMuted(false);
      setDeafened(false);
      setCameraOn(false);
      setScreenSharing(false);
      const localTrack = client.getLocalAudioTrack();
      if (localTrack && me) {
        const stream = new MediaStream([localTrack]);
        attachVoiceActivity(stream, me.id, setSpeaking);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось подключиться к голосу';
      setError(msg);
      try {
        await clientRef.current?.leave();
      } catch {
        /* ignore */
      }
      clientRef.current = null;
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch {
        /* ignore */
      }
      clientRef.current = null;
    }
    for (const el of audioRefs.current.values()) {
      try {
        el.srcObject = null;
        el.remove();
      } catch {
        /* ignore */
      }
    }
    audioRefs.current.clear();
    resetChannel();
  };

  useEffect(() => {
    return () => {
      // No-op: we want voice to persist across channel navigation.
    };
  }, []);

  const toggleMic = () => {
    const next = !micMuted;
    setMicMuted(next);
    clientRef.current?.setMicMuted(next);
  };

  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
    clientRef.current?.setDeafened(next);
    if (next && !micMuted) {
      setMicMuted(true);
      clientRef.current?.setMicMuted(true);
    }
  };

  const toggleCamera = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      if (cameraOn) {
        await client.stopCamera();
        setCameraOn(false);
        if (me) removeVideoTrack(videoTrackKey(me.id, 'camera'));
      } else {
        const track = await client.startCamera();
        setCameraOn(true);
        if (me) setVideoTrack(videoTrackKey(me.id, 'camera'), track);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось включить камеру');
    }
  }, [cameraOn, me, setCameraOn, setError, setVideoTrack, removeVideoTrack]);

  const toggleScreen = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      if (screenSharing) {
        await client.stopScreen();
        setScreenSharing(false);
        if (me) removeVideoTrack(videoTrackKey(me.id, 'screen'));
      } else {
        const track = await client.startScreen();
        setScreenSharing(true);
        if (me) setVideoTrack(videoTrackKey(me.id, 'screen'), track);
        track.addEventListener('ended', () => {
          setScreenSharing(false);
          if (me) removeVideoTrack(videoTrackKey(me.id, 'screen'));
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'NotAllowedError') {
        setError(err.message);
      }
    }
  }, [screenSharing, me, setScreenSharing, setError, setVideoTrack, removeVideoTrack]);

  const peerList = useMemo(() => Array.from(peers.values()), [peers]);

  // Determine if anyone is screen sharing (for layout)
  const screenShareEntries = useMemo(() => {
    const entries: { peerId: string; peer: VoicePeerDto; track: MediaStreamTrack }[] = [];
    for (const p of peerList) {
      const key = videoTrackKey(p.userId, 'screen');
      const track = videoTracks.get(key);
      if (track) entries.push({ peerId: p.userId, peer: p, track });
    }
    return entries;
  }, [peerList, videoTracks]);

  const hasScreenShare = screenShareEntries.length > 0;

  return (
    <div className="flex-1 flex flex-col bg-surface-card">
      <header className="px-5 h-12 border-b border-line flex items-center gap-2">
        <span className="text-ink-tertiary">🔊</span>
        <h2 className="font-semibold text-ink-primary text-base">{channelName}</h2>
        {inThisChannel && (
          <span className="ml-auto text-xs text-positive flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-positive rounded-full" />
            Подключено
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {!inThisChannel ? (
          <EmptyState
            channelName={channelName}
            onConnect={connect}
            connecting={connecting}
            error={error}
          />
        ) : hasScreenShare ? (
          <ScreenShareLayout
            screenShareEntries={screenShareEntries}
            peerList={peerList}
            me={me}
            speaking={speaking}
            videoTracks={videoTracks}
          />
        ) : (
          <VideoGrid
            peerList={peerList}
            me={me}
            speaking={speaking}
            videoTracks={videoTracks}
          />
        )}
      </div>

      {inThisChannel && (
        <footer className="border-t border-line bg-surface-app px-4 py-3 flex items-center justify-center gap-2">
          <ToggleBtn
            active={!micMuted}
            label={micMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            onClick={toggleMic}
            icon={micMuted ? '🎙️/' : '🎙️'}
          />
          <ToggleBtn
            active={!deafened}
            label={deafened ? 'Включить звук' : 'Выключить звук'}
            onClick={toggleDeafen}
            icon={deafened ? '🔇' : '🔊'}
          />
          <ToggleBtn
            active={cameraOn}
            label={cameraOn ? 'Выключить камеру' : 'Включить камеру'}
            onClick={toggleCamera}
            icon={cameraOn ? '📹' : '📹/'}
          />
          <ToggleBtn
            active={screenSharing}
            label={screenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
            onClick={toggleScreen}
            icon={screenSharing ? '🖥️' : '🖥️/'}
          />
          <button
            onClick={disconnect}
            className="ml-2 h-9 px-3 rounded-md bg-danger text-white text-sm font-medium hover:opacity-90 transition"
          >
            Отключиться
          </button>
        </footer>
      )}
    </div>
  );
}

/* ───── Screen-share focused layout ───── */

function ScreenShareLayout({
  screenShareEntries,
  peerList,
  me,
  speaking,
  videoTracks,
}: {
  screenShareEntries: { peerId: string; peer: VoicePeerDto; track: MediaStreamTrack }[];
  peerList: VoicePeerDto[];
  me: { id: string } | null;
  speaking: Set<string>;
  videoTracks: Map<string, MediaStreamTrack>;
}) {
  const mainEntry = screenShareEntries[0]!;
  return (
    <div className="flex gap-3 h-full">
      {/* Main screen share */}
      <div className="flex-1 min-w-0 bg-black rounded-lg overflow-hidden relative">
        <VideoElement track={mainEntry.track} muted={false} className="w-full h-full object-contain" />
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {mainEntry.peer.displayName} — экран
        </div>
      </div>
      {/* Sidebar with participants */}
      <div className="w-48 flex flex-col gap-2 overflow-y-auto shrink-0">
        {peerList.map((p) => (
          <PeerTile
            key={p.userId}
            peer={p}
            isSelf={p.userId === me?.id}
            speaking={speaking.has(p.userId) && !p.micMuted}
            cameraTrack={videoTracks.get(videoTrackKey(p.userId, 'camera'))}
            compact
          />
        ))}
      </div>
    </div>
  );
}

/* ───── Video grid (no screen share) ───── */

function VideoGrid({
  peerList,
  me,
  speaking,
  videoTracks,
}: {
  peerList: VoicePeerDto[];
  me: { id: string } | null;
  speaking: Set<string>;
  videoTracks: Map<string, MediaStreamTrack>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {peerList.map((p) => (
        <PeerTile
          key={p.userId}
          peer={p}
          isSelf={p.userId === me?.id}
          speaking={speaking.has(p.userId) && !p.micMuted}
          cameraTrack={videoTracks.get(videoTrackKey(p.userId, 'camera'))}
        />
      ))}
    </div>
  );
}

/* ───── Peer tile ───── */

function PeerTile({
  peer,
  isSelf,
  speaking,
  cameraTrack,
  compact,
}: {
  peer: VoicePeerDto;
  isSelf: boolean;
  speaking: boolean;
  cameraTrack?: MediaStreamTrack;
  compact?: boolean;
}) {
  const initials = peer.displayName.slice(0, 2).toUpperCase();
  const hasVideo = !!cameraTrack;

  return (
    <div
      className={clsx(
        'rounded-lg border flex flex-col items-center gap-2 transition overflow-hidden',
        compact ? 'p-2' : 'p-4',
        speaking
          ? 'border-positive shadow-pop bg-accent-soft'
          : 'border-line bg-surface-subtle',
      )}
    >
      {hasVideo ? (
        <div className={clsx('relative w-full rounded-md overflow-hidden bg-black', compact ? 'aspect-video' : 'aspect-video')}>
          <VideoElement
            track={cameraTrack}
            muted={isSelf}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className={clsx(
            'rounded-full flex items-center justify-center text-xl font-semibold',
            'bg-accent text-white ring-4 transition',
            speaking ? 'ring-positive' : 'ring-transparent',
            compact ? 'w-10 h-10 text-sm' : 'w-16 h-16',
          )}
        >
          {peer.avatarUrl ? (
            <img
              src={peer.avatarUrl}
              alt={peer.displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
      )}
      <div className={clsx('font-medium text-ink-primary truncate max-w-full', compact ? 'text-xs' : 'text-sm')}>
        {peer.displayName}
        {isSelf && <span className="text-ink-tertiary"> (вы)</span>}
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-tertiary">
        {peer.micMuted && <span title="Микрофон выключен">🎙️/</span>}
        {peer.deafened && <span title="Звук выключен">🔇</span>}
        {peer.cameraOn && <span title="Камера включена">📹</span>}
        {peer.screenSharing && <span title="Демонстрация экрана">🖥️</span>}
      </div>
    </div>
  );
}

/* ───── Video element ───── */

function VideoElement({
  track,
  muted,
  className,
}: {
  track: MediaStreamTrack;
  muted: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stream = new MediaStream([track]);
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}

/* ───── UI helpers ───── */

interface EmptyStateProps {
  channelName: string;
  onConnect: () => void;
  connecting: boolean;
  error: string | null;
}

function EmptyState({ channelName, onConnect, connecting, error }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-ink-tertiary gap-4 px-6 text-center min-h-[60vh]">
      <div className="text-5xl">🔊</div>
      <h3 className="text-xl text-ink-primary font-semibold">{channelName}</h3>
      <p className="max-w-md text-sm">
        В голосовом канале пока никого нет. Нажмите кнопку ниже, чтобы подключиться — браузер
        попросит доступ к микрофону.
      </p>
      <button
        onClick={onConnect}
        disabled={connecting}
        className="h-10 px-5 rounded-md bg-accent text-white font-medium shadow-card hover:bg-accent-hover transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {connecting ? 'Подключение…' : 'Подключиться'}
      </button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}

function ToggleBtn({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx(
        'h-9 w-9 rounded-md text-sm transition flex items-center justify-center',
        active
          ? 'bg-surface-card border border-line text-ink-primary hover:bg-surface-subtle'
          : 'bg-danger-soft text-danger hover:opacity-90',
      )}
    >
      {icon}
    </button>
  );
}

/**
 * Lightweight VU detector via Web Audio API.
 */
function attachVoiceActivity(
  stream: MediaStream,
  peerId: string,
  setSpeaking: (updater: (prev: Set<string>) => Set<string>) => void,
): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const isSpeaking = rms > 0.04;
      setSpeaking((prev) => {
        const has = prev.has(peerId);
        if (isSpeaking && !has) {
          const next = new Set(prev);
          next.add(peerId);
          return next;
        }
        if (!isSpeaking && has) {
          const next = new Set(prev);
          next.delete(peerId);
          return next;
        }
        return prev;
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.addEventListener('ended', () => {
        cancelAnimationFrame(raf);
        try {
          ctx.close();
        } catch {
          /* ignore */
        }
        setSpeaking((prev) => {
          if (!prev.has(peerId)) return prev;
          const next = new Set(prev);
          next.delete(peerId);
          return next;
        });
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[voice] VAD failed', err);
  }
}
