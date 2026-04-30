import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/http';
import { disconnectSocket } from '../lib/socket';

export default function UserPanel() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  async function logout() {
    if (refreshToken) {
      try {
        await api('/auth/logout', { method: 'POST', body: { refreshToken } });
      } catch {
        // ignore
      }
    }
    disconnectSocket();
    clear();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div className="bg-surface-app border-t border-line px-3 py-2.5 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-semibold shrink-0">
        {user.displayName?.[0]?.toUpperCase() ?? user.username[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-primary truncate">{user.displayName}</div>
        <div className="text-xs text-ink-tertiary truncate">@{user.username}</div>
      </div>
      <button
        onClick={logout}
        title="Выйти"
        className="text-ink-tertiary hover:text-danger px-2 py-1 rounded-md hover:bg-surface-subtle transition text-sm"
      >
        ↩
      </button>
    </div>
  );
}
