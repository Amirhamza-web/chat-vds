export interface ChannelDto {
  id: string;
  guildId: string | null;
  name: string;
  type: 'TEXT' | 'VOICE' | 'CATEGORY' | 'DM';
  position: number;
  topic: string | null;
  dmKind?: 'DIRECT' | 'GROUP' | null;
  dmOwnerId?: string | null;
  recipients?: UserDto[];
}

export interface GuildWithChannels {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  channels: ChannelDto[];
}

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface RoleDto {
  id: string;
  guildId: string;
  name: string;
  color: number;
  permissions: string;
  position: number;
  isEveryone: boolean;
}

export interface MemberDto {
  userId: string;
  guildId: string;
  nickname: string | null;
  user: UserDto;
  roles: string[];
}

export interface PermissionOverwriteDto {
  id: string;
  channelId: string;
  type: 'ROLE' | 'MEMBER';
  roleId: string | null;
  userId: string | null;
  allow: string;
  deny: string;
}
