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
    <div className="bg-bg-900 px-2 py-2 flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-semibold">
        {user.displayName?.[0]?.toUpperCase() ?? user.username[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{user.displayName}</div>
        <div className="text-xs text-text-subtle truncate">@{user.username}</div>
      </div>
      <button
        onClick={logout}
        title="Log out"
        className="text-text-subtle hover:text-red-400 px-2 text-sm"
      >
        ↩
      </button>
    </div>
  );
}
