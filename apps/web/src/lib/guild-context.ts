import { useQuery } from '@tanstack/react-query';
import { fetchGuilds } from '../features/guilds/api';
import type { GuildWithChannels } from '../features/guilds/types';

export function useGuildContext(guildId: string | undefined): GuildWithChannels | undefined {
  const { data } = useQuery({
    queryKey: ['guilds'],
    queryFn: fetchGuilds,
  });
  return data?.find((g) => g.id === guildId);
}
