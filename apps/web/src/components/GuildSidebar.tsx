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
      <aside className="w-[68px] bg-surface-app border-r border-line flex flex-col items-center py-3 gap-2 overflow-y-auto">
        <button
          title="Личные сообщения"
          onClick={() => navigate('/dms')}
          className="w-11 h-11 rounded-xl bg-surface-card text-ink-secondary border border-line hover:border-accent hover:text-accent transition flex items-center justify-center text-lg"
        >
          ✉
        </button>
        <div className="w-8 border-t border-line" />
        {guilds.map((g) => {
          const active = guildId === g.id;
          return (
            <button
              key={g.id}
              title={g.name}
              onClick={() => navigate(`/channels/${g.id}`)}
              className={clsx(
                'w-11 h-11 rounded-xl flex items-center justify-center text-sm font-semibold transition border',
                active
                  ? 'bg-accent text-white border-accent shadow-card'
                  : 'bg-surface-card text-ink-secondary border-line hover:border-accent hover:text-accent',
              )}
            >
              {initials(g.name) || '#'}
            </button>
          );
        })}
        <button
          onClick={() => setCreating(true)}
          title="Создать сервер"
          className="w-11 h-11 rounded-xl bg-surface-card border border-dashed border-line text-ink-tertiary hover:border-accent hover:text-accent transition flex items-center justify-center text-xl"
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
      className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-card border border-line rounded-xl shadow-pop p-6 w-full max-w-md flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink-primary">Новый сервер</h2>
          <p className="text-sm text-ink-tertiary">Придумайте название — потом его можно изменить.</p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название сервера"
          className="input"
        />
        {mutation.isError && (
          <div className="text-danger text-sm bg-danger-soft border border-danger/20 px-3 py-2 rounded-md">
            {mutation.error instanceof Error ? mutation.error.message : 'Ошибка'}
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
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || name.length < 2}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md transition"
          >
            {mutation.isPending ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
