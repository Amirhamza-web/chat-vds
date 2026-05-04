import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchGuilds } from '../features/guilds/api';
import GuildSidebar from '../components/GuildSidebar';
import ChannelSidebar from '../components/ChannelSidebar';
import ChatView from '../components/ChatView';
import VoiceView from '../components/VoiceView';
import UserPanel from '../components/UserPanel';
import DMSidebar from '../components/DMSidebar';
import RoleSettings from '../components/RoleSettings';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useAuthStore } from '../lib/store';
import { useGuildContext } from '../lib/guild-context';
import { initPush } from '../lib/push';
import type { GuildWithChannels } from '../features/guilds/types';
import type { ChannelDto } from '../features/guilds/types';

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
    void initPush();
    return () => {
      disconnectSocket();
    };
  }, [accessToken]);

  const firstGuild = useMemo(() => guilds[0], [guilds]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-ink-tertiary">Загрузка…</div>
    );
  }

  return (
    <div className="h-screen flex bg-surface-app text-ink-primary">
      <GuildSidebar guilds={guilds} onCreated={(g) => navigate(`/channels/${g.id}`)} />
      <Routes>
        <Route
          path="/"
          element={firstGuild ? <Navigate to={`/channels/${firstGuild.id}`} replace /> : <EmptyState />}
        />
        <Route path="/channels/:guildId/*" element={<GuildView guilds={guilds} />} />
        <Route path="/dms/*" element={<DMView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-ink-tertiary gap-2 px-6 text-center">
      <p className="text-base text-ink-secondary">Вы пока ни на одном сервере</p>
      <p className="text-sm">Нажмите кнопку «+» слева, чтобы создать новый.</p>
    </div>
  );
}

interface GuildViewProps {
  guilds: GuildWithChannels[];
}

function GuildView({ guilds }: GuildViewProps) {
  const [showRoles, setShowRoles] = useState(false);
  const { guildId } = useParams<{ guildId: string }>();

  return (
    <>
      <div className="w-60 bg-surface-card border-r border-line flex flex-col">
        <ChannelSidebar guilds={guilds} onOpenRoles={() => setShowRoles(true)} />
        <UserPanel />
      </div>
      <main className="flex-1 flex flex-col bg-surface-card min-w-0">
        <Routes>
          <Route index element={<ChannelLanding />} />
          <Route path=":channelId" element={<ChannelRouter />} />
        </Routes>
      </main>
      {showRoles && guildId && (
        <RoleSettings guildId={guildId} onClose={() => setShowRoles(false)} />
      )}
    </>
  );
}

function DMView() {
  const [selectedDm, setSelectedDm] = useState<ChannelDto | null>(null);
  return (
    <>
      <div className="w-60 bg-surface-card border-r border-line flex flex-col">
        <DMSidebar selectedId={selectedDm?.id ?? null} onSelect={setSelectedDm} />
        <UserPanel />
      </div>
      <main className="flex-1 flex flex-col bg-surface-card min-w-0">
        {selectedDm ? (
          <ChatView
            channelId={selectedDm.id}
            channelName={selectedDm.name || 'ЛС'}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-tertiary text-sm">
            Выберите диалог слева
          </div>
        )}
      </main>
    </>
  );
}

function ChannelLanding() {
  return (
    <div className="flex-1 flex items-center justify-center text-ink-tertiary text-sm">
      Выберите канал слева
    </div>
  );
}

function ChannelRouter() {
  const { channelId, guildId } = useParams<{ channelId: string; guildId: string }>();
  const guild = useGuildContext(guildId);
  const channel = guild?.channels.find((c) => c.id === channelId);
  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-tertiary text-sm">
        Канал не найден
      </div>
    );
  }
  if (channel.type === 'TEXT') {
    return <ChatView channelId={channel.id} channelName={channel.name} guildId={guildId} />;
  }
  if (channel.type === 'VOICE') {
    return <VoiceView channelId={channel.id} channelName={channel.name} />;
  }
  return <div className="flex-1" />;
}
