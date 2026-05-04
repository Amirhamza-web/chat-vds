import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRoles, createRole, updateRole, deleteRole } from '../features/guilds/api';
import type { RoleDto } from '../features/guilds/types';
import { Permissions, type PermissionFlag, ALL_PERMISSION_FLAGS } from '@chat-vds/shared';

interface Props {
  guildId: string;
  onClose: () => void;
}

export default function RoleSettings({ guildId, onClose }: Props) {
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({
    queryKey: ['roles', guildId],
    queryFn: () => fetchRoles(guildId),
  });
  const [selected, setSelected] = useState<RoleDto | null>(null);
  const [newName, setNewName] = useState('');
  const [editName, setEditName] = useState('');
  const [editPerms, setEditPerms] = useState('0');

  const addMut = useMutation({
    mutationFn: () => createRole(guildId, { name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles', guildId] });
      setNewName('');
    },
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateRole(selected!.id, { name: editName, permissions: editPerms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles', guildId] });
      setSelected(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles', guildId] });
      setSelected(null);
    },
  });

  function togglePerm(flag: PermissionFlag) {
    const current = BigInt(editPerms || '0');
    const bit = Permissions[flag];
    const next = current & bit ? current & ~bit : current | bit;
    setEditPerms(next.toString());
  }

  function hasPerm(flag: PermissionFlag): boolean {
    return (BigInt(editPerms || '0') & Permissions[flag]) !== 0n;
  }

  return (
    <div
      className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-card border border-line rounded-xl shadow-pop p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-primary">Роли</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-danger">×</button>
        </div>

        {/* Create */}
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название новой роли"
            className="input flex-1 text-sm"
          />
          <button
            onClick={() => addMut.mutate()}
            disabled={!newName.trim() || addMut.isPending}
            className="bg-accent text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
          >
            Создать
          </button>
        </div>

        {/* Role list */}
        <div className="space-y-1">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelected(r);
                setEditName(r.name);
                setEditPerms(r.permissions);
              }}
              className="w-full px-3 py-2 text-left rounded-md hover:bg-surface-subtle text-sm flex items-center gap-2 transition"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#888' }}
              />
              <span className="text-ink-primary flex-1">{r.name}</span>
              {r.isEveryone && <span className="text-xs text-ink-muted">базовая</span>}
            </button>
          ))}
        </div>

        {/* Edit selected */}
        {selected && (
          <div className="border-t border-line pt-4 space-y-3">
            <h3 className="font-semibold text-ink-primary text-sm">
              Редактирование: {selected.name}
            </h3>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input text-sm w-full"
              disabled={selected.isEveryone}
            />

            <div className="grid grid-cols-2 gap-1">
              {ALL_PERMISSION_FLAGS.map((flag) => (
                <label key={flag} className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={hasPerm(flag)}
                    onChange={() => togglePerm(flag)}
                    className="accent-accent"
                  />
                  {flag}
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending}
                className="bg-accent text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
              >
                Сохранить
              </button>
              {!selected.isEveryone && (
                <button
                  onClick={() => deleteMut.mutate(selected.id)}
                  disabled={deleteMut.isPending}
                  className="bg-danger text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
