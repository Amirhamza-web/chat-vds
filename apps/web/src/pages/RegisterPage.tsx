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
      setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-app px-4">
      <form
        onSubmit={onSubmit}
        className="bg-surface-card border border-line rounded-xl shadow-card w-full max-w-md p-8 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-semibold text-ink-primary">Создайте аккаунт</h1>
          <p className="text-sm text-ink-tertiary">Заведите учётную запись в chat-vds</p>
        </div>
        {error && (
          <div className="text-danger text-sm bg-danger-soft border border-danger/20 px-3 py-2 rounded-md">
            {error}
          </div>
        )}
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Имя пользователя">
          <input
            type="text"
            required
            minLength={3}
            maxLength={32}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Отображаемое имя">
          <input
            type="text"
            required
            maxLength={64}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Пароль">
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium py-2.5 rounded-md transition"
        >
          {loading ? 'Создание…' : 'Создать аккаунт'}
        </button>
        <div className="text-sm text-ink-tertiary text-center">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
            Войти
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}
