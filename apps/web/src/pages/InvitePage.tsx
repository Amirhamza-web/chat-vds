import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/http';
import { useAuthStore } from '../lib/store';

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
      setError(e instanceof Error ? e.message : 'Failed to accept');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-700">
      <div className="bg-bg-800 p-8 rounded-md w-full max-w-md text-center flex flex-col gap-4">
        {error && <div className="text-red-400">{error}</div>}
        {invite && (
          <>
            <h1 className="text-2xl font-semibold">You've been invited!</h1>
            <p className="text-text-muted">
              Join <span className="text-white font-semibold">{invite.guild.name}</span>
            </p>
            <button
              onClick={accept}
              disabled={accepting}
              className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 rounded"
            >
              {accepting ? 'Joining…' : 'Accept Invite'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
