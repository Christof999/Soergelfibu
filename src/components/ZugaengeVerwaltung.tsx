import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Telescope, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Mitglied } from '../types';
import ConfirmDialog from './ConfirmDialog';

/**
 * Freigaben für den Akquise-Zugang. Ein Zugang gilt für eine Google-Adresse und
 * öffnet ausschließlich das Akquise-Dokument (Leads) — Angebote, Rechnungen,
 * Umsätze und Kunden bleiben unerreichbar, durchgesetzt von firestore.rules.
 */
export default function ZugaengeVerwaltung() {
  const { user } = useAuth();
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState('');
  const [loeschKandidat, setLoeschKandidat] = useState<Mitglied | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'mitglieder'),
      (snap) => setMitglieder(snap.docs.map(d => d.data() as Mitglied)),
      (e) => console.error('Zugänge konnten nicht geladen werden', e)
    );
    return unsub;
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const hinzufuegen = async () => {
    if (!user) return;
    const adresse = email.trim().toLowerCase();
    setFehler('');

    if (!adresse.includes('@') || /\s/.test(adresse)) {
      setFehler('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    if (adresse === (user.email ?? '').toLowerCase()) {
      setFehler('Das ist deine eigene Adresse.');
      return;
    }
    if (mitglieder.some(m => m.email === adresse)) {
      setFehler('Für diese Adresse gibt es bereits einen Zugang.');
      return;
    }

    setSpeichert(true);
    try {
      const eintrag: Mitglied = {
        email: adresse,
        name: name.trim(),
        rolle: 'akquise',
        erstelltAm: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.uid, 'mitglieder', adresse), eintrag);
      await setDoc(doc(db, 'mitgliedschaften', adresse), {
        ownerUid: user.uid,
        ownerName: user.displayName ?? user.email ?? '',
        rolle: 'akquise',
        erstelltAm: eintrag.erstelltAm,
      });
      setEmail('');
      setName('');
    } catch (e) {
      console.error(e);
      setFehler('Zugang konnte nicht angelegt werden. Ist die Adresse bereits anderswo freigeschaltet?');
    } finally {
      setSpeichert(false);
    }
  };

  const entfernen = async (m: Mitglied) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'mitglieder', m.email));
      await deleteDoc(doc(db, 'mitgliedschaften', m.email));
    } catch (e) {
      console.error(e);
      setFehler('Zugang konnte nicht entfernt werden.');
    }
  };

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-1">
        <Telescope size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-gray-100">Akquise-Zugänge</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5 max-w-prose">
        Freigeschaltete Personen sehen nach der Anmeldung mit ihrem Google-Konto
        ausschließlich das Akquise-Tool. Angebote, Rechnungen, Kunden, Projekte,
        Fibu und Umsätze bleiben verborgen — nicht nur ausgeblendet, sondern
        serverseitig gesperrt.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="google-adresse@gmail.com"
          className="flex-1 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="sm:w-44 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500"
        />
        <button
          type="button"
          onClick={hinzufuegen}
          disabled={speichert}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm font-medium text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          {speichert ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          Freischalten
        </button>
      </div>

      {fehler && (
        <p className="mb-4 px-3 py-2 bg-red-900/40 border border-red-800 rounded-lg text-xs text-red-300">{fehler}</p>
      )}

      {mitglieder.length === 0 ? (
        <p className="text-xs text-gray-600">Noch keine Zugänge vergeben.</p>
      ) : (
        <ul className="space-y-2">
          {mitglieder.map((m) => (
            <li
              key={m.email}
              className="flex items-center gap-3 px-3 py-2.5 bg-dark-900 border border-dark-700 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{m.name || m.email}</p>
                {m.name && <p className="text-xs text-gray-500 truncate">{m.email}</p>}
              </div>
              <span className="shrink-0 text-xs px-2 py-0.5 bg-dark-700 text-gray-400 rounded-full">
                nur Akquise
              </span>
              <button
                type="button"
                onClick={() => setLoeschKandidat(m)}
                title="Zugang entziehen"
                className="shrink-0 p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97]"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!loeschKandidat}
        title="Zugang entziehen"
        message={`${loeschKandidat?.name || loeschKandidat?.email || 'Dieser Zugang'} verliert damit sofort den Zugriff auf das Akquise-Tool.`}
        onClose={() => setLoeschKandidat(null)}
        onConfirm={() => {
          if (loeschKandidat) entfernen(loeschKandidat);
        }}
      />
    </div>
  );
}
