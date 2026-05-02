/**
 * WebSocket event names — single source of truth shared between API and web.
 */

export const SocketEvents = {
  // client → server
  ChannelJoin: 'channel:join',
  ChannelLeave: 'channel:leave',
  TypingStart: 'typing:start',

  // server → client
  MessageNew: 'message:new',
  MessageUpdate: 'message:update',
  MessageDelete: 'message:delete',
  PresenceUpdate: 'presence:update',
  GuildUpdate: 'guild:update',
  GuildMemberAdd: 'guild:member:add',
  GuildMemberRemove: 'guild:member:remove',
  ChannelCreate: 'channel:create',
  ChannelDelete: 'channel:delete',
  TypingUpdate: 'typing:update',
  VoiceParticipants: 'voice:participants',
  Error: 'app:error',
} as const;

/**
 * Voice / SFU signaling events. These flow on a separate Socket.IO connection
 * to apps/sfu (not the main API gateway). Names are namespaced with `voice:`.
 */
export const VoiceEvents = {
  // client → SFU
  Join: 'voice:join',
  Leave: 'voice:leave',
  CreateTransport: 'voice:create-transport',
  ConnectTransport: 'voice:connect-transport',
  Produce: 'voice:produce',
  Consume: 'voice:consume',
  ResumeConsumer: 'voice:resume-consumer',
  CloseProducer: 'voice:close-producer',
  StateUpdate: 'voice:state',

  // SFU → client
  PeerJoined: 'voice:peer-joined',
  PeerLeft: 'voice:peer-left',
  NewProducer: 'voice:new-producer',
  ProducerClosed: 'voice:producer-closed',
  PeerStateUpdate: 'voice:peer-state',
} as const;

export type VoiceEventName = (typeof VoiceEvents)[keyof typeof VoiceEvents];

export interface VoicePeerDto {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  micMuted: boolean;
  deafened: boolean;
}

export interface VoiceParticipantsPayload {
  channelId: string;
  guildId: string | null;
  participants: VoicePeerDto[];
}

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

// ──────────── Payload types ────────────

export interface MessageDto {
  id: string;
  channelId: string;
  authorId: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  content: string;
  createdAt: string;
  editedAt: string | null;
  attachments: AttachmentDto[];
}

export interface AttachmentDto {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface ChannelDto {
  id: string;
  guildId: string | null;
  name: string;
  type: 'TEXT' | 'VOICE' | 'CATEGORY' | 'DM';
  position: number;
  topic: string | null;
  parentId: string | null;
}

export interface GuildDto {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  channels?: ChannelDto[];
}

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MemberDto {
  userId: string;
  guildId: string;
  nickname: string | null;
  roles: string[];
  user: UserDto;
}

export type PresenceStatus = 'online' | 'idle' | 'offline';

export interface PresencePayload {
  userId: string;
  status: PresenceStatus;
}

export interface TypingPayload {
  channelId: string;
  userId: string;
}
