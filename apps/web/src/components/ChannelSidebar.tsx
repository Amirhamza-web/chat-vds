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
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        No guild selected
      </div>
    );
  }

  const isOwner = me?.id === guild.ownerId;

  return (
    <>
      <header className="px-4 py-3 border-b border-bg-900 shadow-sm flex items-center justify-between">
        <h2 className="font-semibold text-white truncate">{guild.name}</h2>
      </header>

      <nav className="flex-1 overflow-y-auto py-2 flex flex-col gap-0.5">
        <SectionHeader
          label="Text channels"
          onAdd={() => setShowCreate(true)}
        />
        {guild.channels
          .filter((c) => c.type === 'TEXT')
          .map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              icon="#"
              active={channelId === c.id}
              onClick={() => navigate(`/channels/${guild.id}/${c.id}`)}
              onDelete={isOwner ? () => deleteChannel(c.id).then(() => qc.invalidateQueries({ queryKey: ['guilds'] })) : undefined}
            />
          ))}

        <SectionHeader label="Voice channels" />
        {guild.channels
          .filter((c) => c.type === 'VOICE')
          .map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              icon="🔊"
              active={channelId === c.id}
              onClick={() => navigate(`/channels/${guild.id}/${c.id}`)}
              onDelete={isOwner ? () => deleteChannel(c.id).then(() => qc.invalidateQueries({ queryKey: ['guilds'] })) : undefined}
            />
          ))}
      </nav>

      <div className="border-t border-bg-900 p-2 flex gap-2 text-xs">
        <button
          onClick={() => inviteMut.mutate()}
          className="flex-1 bg-bg-700 hover:bg-bg-600 px-2 py-1 rounded"
          title="Create invite"
        >
          {inviteMut.isPending ? '…' : 'Invite'}
        </button>
        {isOwner ? (
          <button
            onClick={() => {
              if (confirm(`Delete server "${guild.name}"? This cannot be undone.`)) deleteMut.mutate();
            }}
            className="flex-1 bg-red-900/30 hover:bg-red-900/60 px-2 py-1 rounded"
          >
            Delete
          </button>
        ) : (
          <button
            onClick={() => {
              if (confirm(`Leave "${guild.name}"?`)) leaveMut.mutate();
            }}
            className="flex-1 bg-bg-700 hover:bg-bg-600 px-2 py-1 rounded"
          >
            Leave
          </button>
        )}
      </div>

      {showCreate && (
        <CreateChannelModal guildId={guild.id} onClose={() => setShowCreate(false)} />
      )}
      {inviteCode && (
        <InviteModal code={inviteCode} onClose={() => setInviteCode(null)} />
      )}
    </>
  );
}

function SectionHeader({ label, onAdd }: { label: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 text-xs uppercase font-semibold text-text-subtle">
      <span>{label}</span>
      {onAdd && (
        <button onClick={onAdd} title="Create channel" className="hover:text-white">
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
        'group flex items-center gap-2 px-2 py-1 mx-1 rounded cursor-pointer',
        active ? 'bg-bg-600 text-white' : 'text-text-muted hover:bg-bg-700 hover:text-white',
      )}
      onClick={onClick}
    >
      <span className="text-text-subtle">{icon}</span>
      <span className="flex-1 truncate text-sm">{channel.name}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete #${channel.name}?`)) onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-text-subtle hover:text-red-400 text-xs"
          title="Delete"
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
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-bg-800 rounded-md p-6 w-full max-w-md flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white">Create channel</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setType('TEXT')}
            className={clsx(
              'flex-1 py-2 rounded',
              type === 'TEXT' ? 'bg-accent text-white' : 'bg-bg-700',
            )}
          >
            Text
          </button>
          <button
            onClick={() => setType('VOICE')}
            className={clsx(
              'flex-1 py-2 rounded',
              type === 'VOICE' ? 'bg-accent text-white' : 'bg-bg-700',
            )}
          >
            Voice
          </button>
        </div>
        <input
          autoFocus
          placeholder="channel-name"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          className="bg-bg-900 px-3 py-2 rounded border border-bg-600 focus:border-accent outline-none"
        />
        {mut.isError && (
          <div className="text-red-400 text-sm">
            {mut.error instanceof Error ? mut.error.message : 'Failed'}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || name.length < 1}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-2 rounded"
          >
            {mut.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ code, onClose }: { code: string; onClose: () => void }) {
  const url = `${window.location.origin}/invite/${code}`;
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-bg-800 rounded-md p-6 w-full max-w-md flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white">Invite friends</h2>
        <p className="text-text-muted text-sm">
          Share this link to let people join your server (expires in 7 days):
        </p>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="bg-bg-900 px-3 py-2 rounded border border-bg-600"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(url)}
            className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded"
          >
            Copy link
          </button>
          <button onClick={onClose} className="px-4 py-2">Close</button>
        </div>
      </div>
    </div>
  );
}
