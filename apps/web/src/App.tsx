import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './lib/store';
import { api } from './lib/http';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AppShell from './pages/AppShell';
import InvitePage from './pages/InvitePage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    if (!accessToken) return;
    void api<{
      id: string;
      email: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    }>('/users/me')
      .then((u) => setUser(u))
      .catch(() => clear());
  }, [accessToken, setUser, clear]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
