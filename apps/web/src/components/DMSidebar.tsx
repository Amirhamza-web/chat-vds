import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { fetchDMs, openDM, fetchMembers } from '../features/guilds/api';
import type { ChannelDto } from '../features/guilds/types';
import { useAuthStore } from '../lib/store';

interface Props {
  selectedId: string | null;
  onSelect: (dm: ChannelDto) => void;
}

export default function DMSidebar({ selectedId, onSelect }: Props) {
  const me = useAuthStore((s) => s.user);
  const { data: dms = [] } = useQuery({ queryKey: ['dms'], queryFn: fetchDMs });
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold text-ink-primary">Сообщения</span>
        <button
          onClick={() => setShowNew(true)}
          className="text-ink-muted hover:text-accent text-lg"
          title="Новое сообщение"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {dms.length === 0 && (
          <div className="text-center text-ink-tertiary text-sm py-6">
            Нет диалогов
          </div>
        )}
        {dms.map((dm) => {
          const name = dmName(dm, me?.id);
          return (
            <button
              key={dm.id}
              onClick={() => onSelect(dm)}
              className={clsx(
                'w-full px-3 py-2 text-left flex items-center gap-2 text-sm transition-colors',
                selectedId === dm.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-ink-secondary hover:bg-surface-subtle',
              )}
            >
              <span className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center text-xs font-semibold text-ink-muted">
                {name[0]?.toUpperCase() ?? '?'}
              </span>
              <span className="truncate flex-1">{name}</span>
              {dm.dmKind === 'GROUP' && (
                <span className="text-xs text-ink-muted">{dm.recipients?.length ?? 0}</span>
              )}
            </button>
          );
        })}
      </div>
      {showNew && (
        <NewDMModal onClose={() => setShowNew(false)} onCreated={onSelect} />
      )}
    </div>
  );
}

function dmName(dm: ChannelDto, myId?: string): string {
  if (dm.dmKind === 'GROUP' && dm.name) return dm.name;
  const others = (dm.recipients ?? []).filter((r) => r.id !== myId);
  if (others.length === 0) return 'Заметки';
  return others.map((r) => r.displayName).join(', ');
}

function NewDMModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (dm: ChannelDto) => void;
}) {
  const [username, setUsername] = useState('');
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => openDM(username),
    onSuccess: (dm) => {
      qc.invalidateQueries({ queryKey: ['dms'] });
      onCreated(dm);
      onClose();
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
        <h2 className="text-lg font-semibold text-ink-primary">Новое сообщение</h2>
        <p className="text-sm text-ink-tertiary">Введите ID пользователя</p>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="User ID"
          className="input"
        />
        {mutation.isError && (
          <div className="text-danger text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Ошибка'}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-secondary">
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!username.trim() || mutation.isPending}
            className="bg-accent text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
          >
            Открыть
          </button>
        </div>
      </div>
    </div>
  );
}
