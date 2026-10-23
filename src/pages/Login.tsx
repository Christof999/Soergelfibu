import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fehlendeFirebaseKonfig } from '../firebase/config';

/**
 * Klartext zu den Firebase-Fehlercodes, die beim Anmelden tatsächlich
 * auftreten. Ohne diese Zuordnung bleibt in Vercel-Previews nur ein
 * nichtssagendes „Anmeldung fehlgeschlagen“ übrig.
 */
function erklaerung(code: string, herkunft: string): string {
  switch (code) {
    case 'auth/unauthorized-domain':
      return `Die Domain ${herkunft} ist in Firebase nicht freigegeben. Firebase Console → Authentication → Settings → Authorized domains → Domain hinzufügen. Preview-Deployments von Vercel bekommen bei jedem Branch eine eigene Adresse.`;
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Der Firebase-API-Key fehlt oder ist ungültig. In Vercel unter Settings → Environment Variables prüfen, ob die VITE_FIREBASE_*-Werte auch für „Preview“ gesetzt sind — danach neu deployen.';
    case 'auth/operation-not-allowed':
      return 'Google-Anmeldung ist im Firebase-Projekt nicht aktiviert. Firebase Console → Authentication → Sign-in method → Google aktivieren.';
    case 'auth/popup-blocked':
      return 'Der Browser hat das Anmeldefenster blockiert. Popups für diese Seite erlauben und erneut versuchen.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Das Anmeldefenster wurde geschlossen, bevor die Anmeldung fertig war.';
    case 'auth/network-request-failed':
      return 'Keine Verbindung zu Firebase. Netzwerk oder Blocker im Browser prüfen.';
    default:
      return 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
  }
}

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    setCode('');
    try {
      await signInWithGoogle();
    } catch (e) {
      const fehlerCode = (e as { code?: string })?.code ?? '';
      const herkunft = typeof window !== 'undefined' ? window.location.hostname : 'diese Adresse';
      setCode(fehlerCode);
      setError(erklaerung(fehlerCode, herkunft));
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">SØ</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100">SØRGEL-design</h1>
          <p className="text-sm text-gray-500 mt-1">Angebote & Rechnungen</p>
        </div>

        <p className="text-sm text-gray-400 text-center mb-6">
          Melde dich mit deinem Google-Konto an, um auf deine Daten zuzugreifen – von jedem Gerät aus.
        </p>

        {fehlendeFirebaseKonfig.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-amber-900/40 border border-amber-700 rounded-lg text-sm text-amber-200">
            <p className="font-semibold mb-1">Firebase ist nicht konfiguriert</p>
            <p className="text-xs text-amber-300/90">
              Diese Variablen fehlen im Build: {fehlendeFirebaseKonfig.join(', ')}. In Vercel unter
              Settings → Environment Variables für die passende Umgebung setzen und neu deployen.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-300">
            <p>{error}</p>
            {code && <p className="mt-1.5 text-xs text-red-400/80 font-mono break-all">{code}</p>}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-dark-700 border border-dark-700 rounded-xl text-sm font-semibold text-gray-200 hover:border-primary-500 hover:bg-dark-700/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-primary-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          {loading ? 'Anmelden…' : 'Mit Google anmelden'}
        </button>

        <p className="text-xs text-gray-600 text-center mt-6">
          Deine Daten werden sicher in Firebase gespeichert.<br />
          Nur du hast Zugriff auf dein Konto.
        </p>
      </div>
    </div>
  );
}
