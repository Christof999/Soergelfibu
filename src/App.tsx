import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Kunden from './pages/Kunden';
import ArtikelPage from './pages/Artikel';
import DokumentList from './pages/DokumentList';
import Einstellungen from './pages/Einstellungen';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="kunden" element={<Kunden />} />
            <Route path="artikel" element={<ArtikelPage />} />
            <Route path="angebote" element={<DokumentList typ="angebot" />} />
            <Route path="rechnungen" element={<DokumentList typ="rechnung" />} />
            <Route path="einstellungen" element={<Einstellungen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
