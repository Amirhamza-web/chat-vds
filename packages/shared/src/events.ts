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
  Error: 'app:error',
} as const;

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
