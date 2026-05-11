import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Kunden from './pages/Kunden';
import ArtikelPage from './pages/Artikel';
import DokumentList from './pages/DokumentList';
import Einstellungen from './pages/Einstellungen';
import Projekte from './pages/Projekte';
import ProjektDetail from './pages/ProjektDetail';
import Akquise from './pages/Akquise';
import Fibu from './pages/Fibu';
import ServiceVertraege from './pages/ServiceVertraege';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-sm text-gray-400">Lade…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="kunden" element={<Kunden />} />
          <Route path="artikel" element={<ArtikelPage />} />
          <Route path="angebote" element={<DokumentList typ="angebot" />} />
          <Route path="rechnungen" element={<DokumentList typ="rechnung" />} />
          <Route path="projekte" element={<Projekte />} />
          <Route path="projekte/:id" element={<ProjektDetail />} />
          <Route path="akquise" element={<Akquise />} />
          <Route path="fibu" element={<Fibu />} />
          <Route path="service" element={<ServiceVertraege />} />
          <Route path="einstellungen" element={<Einstellungen />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginGate />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function LoginGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
