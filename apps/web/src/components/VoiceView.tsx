import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { VoicePeerDto } from '@chat-vds/shared';
import { VoiceClient } from '../lib/voice';
import { useVoiceStore } from '../lib/voice-store';
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
  const connecting = useVoiceStore((s) => s.connecting);
  const error = useVoiceStore((s) => s.error);
  const activeChannelId = useVoiceStore((s) => s.channelId);
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
      onPeerStateUpdate: ({ userId, micMuted, deafened }) =>
        setPeerState(userId, micMuted, deafened),
      onRemoteAudio: (peerId, track) => {
        let el = audioRefs.current.get(peerId);
        if (!el) {
          el = document.createElement('audio');
          el.autoplay = true;
          el.dataset.peerId = peerId;
          // Hidden — UI shows peer card; the audio element just plays sound.
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
        if (el) {
          el.srcObject = null;
        }
      },
      onError: (msg) => setError(msg),
    });
    clientRef.current = client;
    try {
      await client.connect();
      const initialPeers = await client.join(channelId);
      // include self
      const self: VoicePeerDto | null = me
        ? {
            userId: me.id,
            username: me.username,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
            micMuted: false,
            deafened: false,
          }
        : null;
      setPeers(self ? [self, ...initialPeers] : initialPeers);
      setActiveChannel(channelId, channelName);
      setMicMuted(false);
      setDeafened(false);
      // Local mic VU
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

  // Disconnect on unmount only if user explicitly left — we keep voice active
  // when user navigates to other channels. Only fully cleanup on logout (not
  // handled here, AppShell can hook into auth changes).
  useEffect(() => {
    return () => {
      // No-op: we want voice to persist across channel navigation. Disconnect
      // is explicit via leave button.
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

  const peerList = useMemo(() => Array.from(peers.values()), [peers]);

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

      <div className="flex-1 overflow-y-auto p-6">
        {!inThisChannel ? (
          <EmptyState
            channelName={channelName}
            onConnect={connect}
            connecting={connecting}
            error={error}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {peerList.map((p) => (
              <PeerTile
                key={p.userId}
                peer={p}
                isSelf={p.userId === me?.id}
                speaking={speaking.has(p.userId) && !p.micMuted}
              />
            ))}
          </div>
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

function PeerTile({
  peer,
  isSelf,
  speaking,
}: {
  peer: VoicePeerDto;
  isSelf: boolean;
  speaking: boolean;
}) {
  const initials = peer.displayName.slice(0, 2).toUpperCase();
  return (
    <div
      className={clsx(
        'rounded-lg border p-4 flex flex-col items-center gap-2 transition',
        speaking
          ? 'border-positive shadow-pop bg-accent-soft'
          : 'border-line bg-surface-subtle',
      )}
    >
      <div
        className={clsx(
          'w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold',
          'bg-accent text-white ring-4 transition',
          speaking ? 'ring-positive' : 'ring-transparent',
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
      <div className="text-sm font-medium text-ink-primary truncate max-w-full">
        {peer.displayName}
        {isSelf && <span className="text-ink-tertiary"> (вы)</span>}
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-tertiary">
        {peer.micMuted && <span title="Микрофон выключен">🎙️/</span>}
        {peer.deafened && <span title="Звук выключен">🔇</span>}
      </div>
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
 * Lightweight VU detector via Web Audio API. Updates the speaking set when
 * the stream's RMS energy exceeds a threshold for a brief window.
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
      const speaking = rms > 0.04;
      setSpeaking((prev) => {
        const has = prev.has(peerId);
        if (speaking && !has) {
          const next = new Set(prev);
          next.add(peerId);
          return next;
        }
        if (!speaking && has) {
          const next = new Set(prev);
          next.delete(peerId);
          return next;
        }
        return prev;
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    // Cleanup on track end
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
