import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/http';
import { useAuthStore, type AuthUser } from '../lib/store';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{
        user: AuthUser;
        tokens: { accessToken: string; refreshToken: string };
      }>('/auth/register', {
        method: 'POST',
        body: { email, username, displayName, password },
        skipAuth: true,
      });
      setSession({
        user: res.user,
        accessToken: res.tokens.accessToken,
        refreshToken: res.tokens.refreshToken,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-700">
      <form
        onSubmit={onSubmit}
        className="bg-bg-800 p-8 rounded-md shadow-lg w-full max-w-md flex flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold text-white text-center">Create your account</h1>
        {error && (
          <div className="text-red-400 text-sm bg-red-900/30 p-2 rounded">{error}</div>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase font-semibold text-text-muted">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-bg-900 text-text-primary px-3 py-2 rounded border border-bg-600 focus:border-accent outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase font-semibold text-text-muted">Username</span>
          <input
            type="text"
            required
            minLength={3}
            maxLength={32}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-bg-900 text-text-primary px-3 py-2 rounded border border-bg-600 focus:border-accent outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase font-semibold text-text-muted">Display name</span>
          <input
            type="text"
            required
            maxLength={64}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-bg-900 text-text-primary px-3 py-2 rounded border border-bg-600 focus:border-accent outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase font-semibold text-text-muted">Password</span>
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-bg-900 text-text-primary px-3 py-2 rounded border border-bg-600 focus:border-accent outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold py-2 rounded transition"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <div className="text-sm text-text-muted text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </div>
      </form>
    </div>
  );
}
