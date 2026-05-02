import { create } from 'zustand';
import type { VoicePeerDto } from '@chat-vds/shared';

/** Key: `${peerId}:${source}` where source is 'camera' | 'screen' */
export type VideoTrackKey = string;
export function videoTrackKey(peerId: string, source: 'camera' | 'screen'): VideoTrackKey {
  return `${peerId}:${source}`;
}

interface VoiceState {
  channelId: string | null;
  channelName: string | null;
  peers: Map<string, VoicePeerDto>;
  micMuted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  connecting: boolean;
  error: string | null;

  /** Remote (and local) video tracks keyed by peerId:source */
  videoTracks: Map<VideoTrackKey, MediaStreamTrack>;

  setConnecting: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setActiveChannel: (channelId: string, channelName: string) => void;
  resetChannel: () => void;
  setPeers: (peers: VoicePeerDto[]) => void;
  upsertPeer: (peer: VoicePeerDto) => void;
  removePeer: (userId: string) => void;
  setPeerState: (userId: string, updates: Partial<Pick<VoicePeerDto, 'micMuted' | 'deafened' | 'cameraOn' | 'screenSharing'>>) => void;
  setMicMuted: (v: boolean) => void;
  setDeafened: (v: boolean) => void;
  setCameraOn: (v: boolean) => void;
  setScreenSharing: (v: boolean) => void;
  setVideoTrack: (key: VideoTrackKey, track: MediaStreamTrack) => void;
  removeVideoTrack: (key: VideoTrackKey) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  channelId: null,
  channelName: null,
  peers: new Map(),
  micMuted: false,
  deafened: false,
  cameraOn: false,
  screenSharing: false,
  connecting: false,
  error: null,
  videoTracks: new Map(),

  setConnecting: (v) => set({ connecting: v }),
  setError: (msg) => set({ error: msg }),
  setActiveChannel: (channelId, channelName) => set({ channelId, channelName, error: null }),
  resetChannel: () =>
    set({
      channelId: null,
      channelName: null,
      peers: new Map(),
      micMuted: false,
      deafened: false,
      cameraOn: false,
      screenSharing: false,
      connecting: false,
      videoTracks: new Map(),
    }),
  setPeers: (peers) => {
    const map = new Map<string, VoicePeerDto>();
    for (const p of peers) map.set(p.userId, p);
    set({ peers: map });
  },
  upsertPeer: (peer) =>
    set((s) => {
      const next = new Map(s.peers);
      next.set(peer.userId, peer);
      return { peers: next };
    }),
  removePeer: (userId) =>
    set((s) => {
      const next = new Map(s.peers);
      next.delete(userId);
      const tracks = new Map(s.videoTracks);
      tracks.delete(videoTrackKey(userId, 'camera'));
      tracks.delete(videoTrackKey(userId, 'screen'));
      return { peers: next, videoTracks: tracks };
    }),
  setPeerState: (userId, updates) =>
    set((s) => {
      const existing = s.peers.get(userId);
      if (!existing) return {};
      const next = new Map(s.peers);
      next.set(userId, { ...existing, ...updates });
      return { peers: next };
    }),
  setMicMuted: (v) => set({ micMuted: v }),
  setDeafened: (v) => set({ deafened: v }),
  setCameraOn: (v) => set({ cameraOn: v }),
  setScreenSharing: (v) => set({ screenSharing: v }),
  setVideoTrack: (key, track) =>
    set((s) => {
      const next = new Map(s.videoTracks);
      next.set(key, track);
      return { videoTracks: next };
    }),
  removeVideoTrack: (key) =>
    set((s) => {
      const next = new Map(s.videoTracks);
      next.delete(key);
      return { videoTracks: next };
    }),
}));
