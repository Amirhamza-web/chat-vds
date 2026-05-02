import { VoiceRoom } from './room.js';

const rooms = new Map<string, VoiceRoom>();
const creating = new Map<string, Promise<VoiceRoom>>();

export async function getOrCreateRoom(
  channelId: string,
  guildId: string | null,
): Promise<VoiceRoom> {
  const existing = rooms.get(channelId);
  if (existing) return existing;
  const inFlight = creating.get(channelId);
  if (inFlight) return inFlight;
  const p = VoiceRoom.create(channelId, guildId).then((r) => {
    rooms.set(channelId, r);
    creating.delete(channelId);
    return r;
  });
  creating.set(channelId, p);
  return p;
}

export function getRoom(channelId: string): VoiceRoom | undefined {
  return rooms.get(channelId);
}

export function deleteRoom(channelId: string): void {
  const r = rooms.get(channelId);
  if (!r) return;
  r.close();
  rooms.delete(channelId);
}

export function listRooms(): VoiceRoom[] {
  return Array.from(rooms.values());
}
