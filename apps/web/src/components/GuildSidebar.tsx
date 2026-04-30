import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { createGuild } from '../features/guilds/api';
import type { GuildWithChannels } from '../features/guilds/types';

interface Props {
  guilds: GuildWithChannels[];
  onCreated?: (g: GuildWithChannels) => void;
}

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function GuildSidebar({ guilds, onCreated }: Props) {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <aside className="w-[72px] bg-bg-900 flex flex-col items-center py-3 gap-2 overflow-y-auto">
        {guilds.map((g) => (
          <button
            key={g.id}
            title={g.name}
            onClick={() => navigate(`/channels/${g.id}`)}
            className={clsx(
              'w-12 h-12 rounded-2xl bg-bg-800 hover:bg-accent hover:rounded-xl transition-all flex items-center justify-center text-white font-semibold',
              guildId === g.id && 'bg-accent rounded-xl',
            )}
          >
            {initials(g.name) || '#'}
          </button>
        ))}
        <button
          onClick={() => setCreating(true)}
          title="Create server"
          className="w-12 h-12 rounded-2xl bg-bg-800 hover:bg-green-600 hover:rounded-xl transition-all flex items-center justify-center text-green-500 hover:text-white text-2xl"
        >
          +
        </button>
      </aside>
      {creating && (
        <CreateGuildModal
          onClose={() => setCreating(false)}
          onCreated={(g) => {
            setCreating(false);
            onCreated?.(g);
          }}
        />
      )}
    </>
  );
}

function CreateGuildModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (g: GuildWithChannels) => void;
}) {
  const [name, setName] = useState('');
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => createGuild(name),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ['guilds'] });
      onCreated(g);
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
        <h2 className="text-xl font-semibold text-white">Create a server</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Server name"
          className="bg-bg-900 px-3 py-2 rounded border border-bg-600 focus:border-accent outline-none"
        />
        {mutation.isError && (
          <div className="text-red-400 text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed'}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 hover:underline">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || name.length < 2}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-2 rounded"
          >
            {mutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
