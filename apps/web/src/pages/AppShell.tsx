import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchGuilds } from '../features/guilds/api';
import GuildSidebar from '../components/GuildSidebar';
import ChannelSidebar from '../components/ChannelSidebar';
import ChatView from '../components/ChatView';
import VoicePlaceholder from '../components/VoicePlaceholder';
import UserPanel from '../components/UserPanel';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useAuthStore } from '../lib/store';
import { useGuildContext } from '../lib/guild-context';
import type { GuildWithChannels } from '../features/guilds/types';

export default function AppShell() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const { data: guilds = [], isLoading } = useQuery({
    queryKey: ['guilds'],
    queryFn: fetchGuilds,
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (!accessToken) return;
    getSocket();
    return () => {
      disconnectSocket();
    };
  }, [accessToken]);

  const firstGuild = useMemo(() => guilds[0], [guilds]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-text-muted">Loading…</div>
    );
  }

  return (
    <div className="h-screen flex bg-bg-900 text-text-primary">
      <GuildSidebar guilds={guilds} onCreated={(g) => navigate(`/channels/${g.id}`)} />
      <Routes>
        <Route
          path="/"
          element={firstGuild ? <Navigate to={`/channels/${firstGuild.id}`} replace /> : <EmptyState />}
        />
        <Route path="/channels/:guildId/*" element={<GuildView guilds={guilds} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-3">
      <p>You're not in any servers yet.</p>
      <p className="text-sm">Click the + button on the left to create one.</p>
    </div>
  );
}

interface GuildViewProps {
  guilds: GuildWithChannels[];
}

function GuildView({ guilds }: GuildViewProps) {
  return (
    <>
      <div className="w-60 bg-bg-800 flex flex-col">
        <ChannelSidebar guilds={guilds} />
        <UserPanel />
      </div>
      <main className="flex-1 flex flex-col bg-bg-700 min-w-0">
        <Routes>
          <Route index element={<ChannelLanding />} />
          <Route path=":channelId" element={<ChannelRouter />} />
        </Routes>
      </main>
    </>
  );
}

function ChannelLanding() {
  return (
    <div className="flex-1 flex items-center justify-center text-text-muted">
      Pick a channel from the left.
    </div>
  );
}

function ChannelRouter() {
  const { channelId, guildId } = useParams<{ channelId: string; guildId: string }>();
  const guild = useGuildContext(guildId);
  const channel = guild?.channels.find((c) => c.id === channelId);
  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        Channel not found
      </div>
    );
  }
  if (channel.type === 'TEXT') {
    return <ChatView channelId={channel.id} channelName={channel.name} />;
  }
  if (channel.type === 'VOICE') {
    return <VoicePlaceholder channelName={channel.name} />;
  }
  return <div className="flex-1" />;
}
