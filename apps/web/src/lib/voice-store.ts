import { create } from 'zustand';
import type { VoicePeerDto } from '@chat-vds/shared';

interface VoiceState {
  channelId: string | null;
  channelName: string | null;
  /** Map of userId -> peer info (includes the local user once joined). */
  peers: Map<string, VoicePeerDto>;
  micMuted: boolean;
  deafened: boolean;
  connecting: boolean;
  error: string | null;

  setConnecting: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setActiveChannel: (channelId: string, channelName: string) => void;
  resetChannel: () => void;
  setPeers: (peers: VoicePeerDto[]) => void;
  upsertPeer: (peer: VoicePeerDto) => void;
  removePeer: (userId: string) => void;
  setPeerState: (userId: string, micMuted: boolean, deafened: boolean) => void;
  setMicMuted: (v: boolean) => void;
  setDeafened: (v: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  channelId: null,
  channelName: null,
  peers: new Map(),
  micMuted: false,
  deafened: false,
  connecting: false,
  error: null,

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
      connecting: false,
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
      return { peers: next };
    }),
  setPeerState: (userId, micMuted, deafened) =>
    set((s) => {
      const existing = s.peers.get(userId);
      if (!existing) return {};
      const next = new Map(s.peers);
      next.set(userId, { ...existing, micMuted, deafened });
      return { peers: next };
    }),
  setMicMuted: (v) => set({ micMuted: v }),
  setDeafened: (v) => set({ deafened: v }),
}));
