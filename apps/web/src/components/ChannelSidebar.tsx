import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  createChannel,
  createInvite,
  deleteChannel,
  deleteGuild,
  leaveGuild,
} from '../features/guilds/api';
import type { ChannelDto, GuildWithChannels } from '../features/guilds/types';
import { useAuthStore } from '../lib/store';

interface Props {
  guilds: GuildWithChannels[];
}

export default function ChannelSidebar({ guilds }: Props) {
  const { guildId, channelId } = useParams<{ guildId: string; channelId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const guild = guilds.find((g) => g.id === guildId);
  const [showCreate, setShowCreate] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const inviteMut = useMutation({
    mutationFn: () => createInvite(guildId!),
    onSuccess: (data) => setInviteCode(data.code),
  });
  const leaveMut = useMutation({
    mutationFn: () => leaveGuild(guildId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guilds'] });
      navigate('/');
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteGuild(guildId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guilds'] });
      navigate('/');
    },
  });

  if (!guild) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-tertiary text-sm">
        Сервер не выбран
      </div>
    );
  }

  const isOwner = me?.id === guild.ownerId;

  return (
    <>
      <header className="px-4 py-3 border-b border-line flex items-center justify-between">
        <h2 className="font-semibold text-ink-primary truncate">{guild.name}</h2>
      </header>

      <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-1">
        <SectionHeader label="Текстовые каналы" onAdd={() => setShowCreate(true)} />
        {guild.channels
          .filter((c) => c.type === 'TEXT')
          .map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              icon="#"
              active={channelId === c.id}
              onClick={() => navigate(`/channels/${guild.id}/${c.id}`)}
              onDelete={
                isOwner
                  ? () => deleteChannel(c.id).then(() => qc.invalidateQueries({ queryKey: ['guilds'] }))
                  : undefined
              }
            />
          ))}

        <div className="mt-2" />
        <SectionHeader label="Голосовые каналы" />
        {guild.channels
          .filter((c) => c.type === 'VOICE')
          .map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              icon="🔊"
              active={channelId === c.id}
              onClick={() => navigate(`/channels/${guild.id}/${c.id}`)}
              onDelete={
                isOwner
                  ? () => deleteChannel(c.id).then(() => qc.invalidateQueries({ queryKey: ['guilds'] }))
                  : undefined
              }
            />
          ))}
      </nav>

      <div className="border-t border-line p-2 flex gap-2 text-xs">
        <button
          onClick={() => inviteMut.mutate()}
          className="flex-1 bg-surface-subtle hover:bg-surface-muted text-ink-secondary px-2 py-1.5 rounded-md transition"
          title="Создать приглашение"
        >
          {inviteMut.isPending ? '…' : 'Пригласить'}
        </button>
        {isOwner ? (
          <button
            onClick={() => {
              if (confirm(`Удалить сервер «${guild.name}»? Это действие необратимо.`))
                deleteMut.mutate();
            }}
            className="flex-1 bg-danger-soft hover:bg-danger/10 text-danger px-2 py-1.5 rounded-md transition"
          >
            Удалить
          </button>
        ) : (
          <button
            onClick={() => {
              if (confirm(`Покинуть «${guild.name}»?`)) leaveMut.mutate();
            }}
            className="flex-1 bg-surface-subtle hover:bg-surface-muted text-ink-secondary px-2 py-1.5 rounded-md transition"
          >
            Покинуть
          </button>
        )}
      </div>

      {showCreate && <CreateChannelModal guildId={guild.id} onClose={() => setShowCreate(false)} />}
      {inviteCode && <InviteModal code={inviteCode} onClose={() => setInviteCode(null)} />}
    </>
  );
}

function SectionHeader({ label, onAdd }: { label: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-[11px] uppercase tracking-wide font-semibold text-ink-muted">
      <span>{label}</span>
      {onAdd && (
        <button onClick={onAdd} title="Создать канал" className="hover:text-accent">
          +
        </button>
      )}
    </div>
  );
}

function ChannelRow({
  channel,
  icon,
  active,
  onClick,
  onDelete,
}: {
  channel: ChannelDto;
  icon: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={clsx(
        'group flex items-center gap-2 px-2.5 py-1.5 mx-2 rounded-md cursor-pointer transition',
        active
          ? 'bg-accent-soft text-accent'
          : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary',
      )}
      onClick={onClick}
    >
      <span className={clsx(active ? 'text-accent' : 'text-ink-muted')}>{icon}</span>
      <span className="flex-1 truncate text-sm">{channel.name}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Удалить #${channel.name}?`)) onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-danger text-xs"
          title="Удалить"
        >
          ×
        </button>
      )}
    </div>
  );
}

function CreateChannelModal({ guildId, onClose }: { guildId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'TEXT' | 'VOICE'>('TEXT');
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => createChannel(guildId, { name, type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guilds'] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 bg-ink-primary/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-card border border-line rounded-xl shadow-pop p-6 w-full max-w-md flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink-primary">Новый канал</h2>
          <p className="text-sm text-ink-tertiary">Только латиница, цифры и дефис.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setType('TEXT')}
            className={clsx(
              'flex-1 py-2 rounded-md border text-sm font-medium transition',
              type === 'TEXT'
                ? 'bg-accent text-white border-accent'
                : 'bg-surface-card border-line text-ink-secondary hover:border-accent',
            )}
          >
            # Текстовый
          </button>
          <button
            onClick={() => setType('VOICE')}
            className={clsx(
              'flex-1 py-2 rounded-md border text-sm font-medium transition',
              type === 'VOICE'
                ? 'bg-accent text-white border-accent'
                : 'bg-surface-card border-line text-ink-secondary hover:border-accent',
            )}
          >
            🔊 Голосовой
          </button>
        </div>
        <input
          autoFocus
          placeholder="название-канала"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          className="input"
        />
        {mut.isError && (
          <div className="text-danger text-sm bg-danger-soft border border-danger/20 px-3 py-2 rounded-md">
            {mut.error instanceof Error ? mut.error.message : 'Ошибка'}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md text-ink-secondary hover:bg-surface-subtle transition"
          >
            Отмена
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || name.length < 1}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md transition"
          >
            {mut.isPending ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ code, onClose }: { code: string; onClose: () => void }) {
  const url = `${window.location.origin}/invite/${code}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink-primary/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-card border border-line rounded-xl shadow-pop p-6 w-full max-w-md flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink-primary">Пригласить друзей</h2>
          <p className="text-sm text-ink-tertiary">
            Поделитесь ссылкой — она действует 7 дней.
          </p>
        </div>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="input font-mono text-sm"
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md text-ink-secondary hover:bg-surface-subtle transition"
          >
            Закрыть
          </button>
          <button
            onClick={copy}
            className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-md transition"
          >
            {copied ? 'Скопировано' : 'Скопировать ссылку'}
          </button>
        </div>
      </div>
    </div>
  );
}
