import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './session';
import { LoginPage } from './pages/Login';
import { UsersPage } from './pages/Users';
import { UserDetailPage } from './pages/UserDetail';

function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useSession();
  return (
    <>
      <header className="topbar">
        <strong>💪 GymBros Admin</strong>
        <button className="link" onClick={signOut}>
          Вийти
        </button>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

export function App() {
  const { user } = useSession();
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<UsersPage />} />
        <Route path="/users/:id" element={<UserDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
