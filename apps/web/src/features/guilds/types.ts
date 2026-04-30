export interface ChannelDto {
  id: string;
  guildId: string | null;
  name: string;
  type: 'TEXT' | 'VOICE' | 'CATEGORY' | 'DM';
  position: number;
  topic: string | null;
}

export interface GuildWithChannels {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  channels: ChannelDto[];
}
