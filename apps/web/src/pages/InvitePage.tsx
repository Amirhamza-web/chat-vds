import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/http';
import { useAuthStore } from '../lib/store';
import ThemeToggle from '../components/ThemeToggle';

interface InviteInfo {
  code: string;
  guildId: string;
  guild: { id: string; name: string };
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) return;
    api<InviteInfo>(`/invites/${code}`, { skipAuth: true })
      .then(setInvite)
      .catch((e: Error) => setError(e.message));
  }, [code]);

  async function accept() {
    if (!accessToken) {
      navigate(`/login?redirect=/invite/${code}`);
      return;
    }
    if (!code) return;
    setAccepting(true);
    try {
      const guild = await api<{ id: string }>(`/invites/${code}/accept`, { method: 'POST' });
      navigate(`/channels/${guild.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось принять приглашение');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-app px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-surface-card border border-line rounded-xl shadow-card w-full max-w-md p-8 text-center flex flex-col gap-5">
        {error && (
          <div className="text-danger text-sm bg-danger-soft border border-danger/20 px-3 py-2 rounded-md">
            {error}
          </div>
        )}
        {invite && (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-ink-primary">Вас пригласили</h1>
              <p className="text-ink-tertiary text-sm">
                Присоединиться к серверу{' '}
                <span className="text-ink-primary font-semibold">{invite.guild.name}</span>
              </p>
            </div>
            <button
              onClick={accept}
              disabled={accepting}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium py-2.5 rounded-md transition"
            >
              {accepting ? 'Подключение…' : 'Принять приглашение'}
            </button>
          </>
        )}
        {!invite && !error && (
          <div className="text-ink-tertiary text-sm">Загрузка…</div>
        )}
      </div>
    </div>
  );
}
