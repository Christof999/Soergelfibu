import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Loader2, Radar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { GesuchTreffer, GesucheZustand } from '../types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { readApiJson } from '../utils/readApiJson';

const eingabeKlasse =
  'w-full min-h-[44px] bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500';
const knopfKlasse =
  'min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

type Aktion =
  | { aktion: 'einstellungen'; email: string; suchanfragen: string[]; tage: number }
  | { aktion: 'lauf' }
  | { aktion: 'push-abo'; abo: PushSubscriptionJSON }
  | { aktion: 'push-test' }
  | { aktion: 'treffer-entfernen'; url: string };

/** Zustand (bei Lauf mit Zählern) oder bei „push-test“ nur die Zahl zugestellter Nachrichten. */
type Antwort = Partial<GesucheZustand> & { neueTreffer?: number; zugestellt?: number };

/** VAPID-Schlüssel (Base64url) → Bytes für pushManager.subscribe */
function base64UrlZuBytes(s: string) {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function pushHinweis(): string | null {
  if ('serviceWorker' in navigator && 'PushManager' in window) return null;
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return iOS
    ? 'Auf dem iPhone gehen Push-Nachrichten nur aus der installierten App: in Safari Teilen → „Zum Home-Bildschirm“, dann die App von dort öffnen.'
    : 'Dieser Browser unterstützt keine Push-Nachrichten.';
}

function TrefferKarte({ treffer, onEntfernen }: { treffer: GesuchTreffer; onEntfernen: () => void }) {
  const [kopiert, setKopiert] = useState(false);

  const kopieren = async () => {
    await navigator.clipboard.writeText(treffer.antwortVorschlag);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 1500);
  };

  const scoreFarbe =
    treffer.score >= 70 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/30 text-amber-300';

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={treffer.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-100 hover:text-primary-300 break-words inline-flex items-start gap-1"
          >
            {treffer.titel} <ExternalLink size={11} className="shrink-0 mt-1" />
          </a>
          <p className="text-xs text-gray-500 mt-0.5">
            {treffer.quelle} · Beitrag vom {format(new Date(treffer.datum), 'dd.MM.yyyy', { locale: de })} · gefunden{' '}
            {format(new Date(treffer.gefundenAm), 'dd.MM.yyyy', { locale: de })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreFarbe}`} title="Wie warm der Kontakt ist (0–100)">
            {treffer.score}
          </span>
          <button
            type="button"
            onClick={onEntfernen}
            className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
            title="Erledigt — aus der Liste nehmen"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {treffer.zusammenfassung && <p className="text-xs text-gray-400">{treffer.zusammenfassung}</p>}

      {treffer.antwortVorschlag && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Antwortvorschlag</p>
          <p className="text-xs text-gray-300 whitespace-pre-line">{treffer.antwortVorschlag}</p>
          <button
            type="button"
            onClick={kopieren}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-dark-700 text-gray-300 border border-dark-600 rounded-lg hover:bg-dark-600 transition-colors"
          >
            {kopiert ? <Check size={12} /> : <Copy size={12} />}
            {kopiert ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function GesucheImNetz() {
  const { user } = useAuth();
  const { data } = useApp();
  const firmenEmail = data.firma.email.trim();

  const [zustand, setZustand] = useState<GesucheZustand | null>(null);
  const [laeuft, setLaeuft] = useState<Aktion['aktion'] | 'laden' | null>('laden');
  const [fehler, setFehler] = useState('');
  const [meldung, setMeldung] = useState('');
  const [pushAufGeraet, setPushAufGeraet] = useState(false);
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  const [suchanfragen, setSuchanfragen] = useState('');
  const [tage, setTage] = useState('30');

  const api = useCallback(
    async <T,>(aktion?: Aktion): Promise<T> => {
      if (!user) throw new Error('Nicht angemeldet');
      const res = await fetch('/api/gesuche', {
        method: aktion ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
        ...(aktion ? { body: JSON.stringify(aktion) } : {}),
      });
      const parsed = await readApiJson<T & { error?: string }>(res);
      if (parsed.jsonError) throw new Error(`Unerwartete Server-Antwort (${res.status}).`);
      if (!res.ok) throw new Error(parsed.data?.error ?? `Fehler ${res.status}`);
      return parsed.data!;
    },
    [user],
  );

  const ausfuehren = async (aktion: Aktion, erfolg?: (antwort: Antwort) => string) => {
    setLaeuft(aktion.aktion);
    setFehler('');
    setMeldung('');
    try {
      const antwort = await api<Antwort>(aktion);
      if (antwort.treffer) setZustand(antwort as GesucheZustand);
      if (erfolg) setMeldung(erfolg(antwort));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setLaeuft(null);
    }
  };

  useEffect(() => {
    api<GesucheZustand>()
      .then(z => {
        setZustand(z);
        setSuchanfragen(z.einstellungen.suchanfragen.join('\n'));
        setTage(String(z.einstellungen.tage));
      })
      .catch(e => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaeuft(null));
    navigator.serviceWorker?.ready
      .then(r => r.pushManager?.getSubscription())
      .then(abo => setPushAufGeraet(!!abo))
      .catch(() => {});
  }, [api]);

  // Der Server kann die Firmendaten nicht lesen — die Empfänger-Adresse kommt von hier.
  useEffect(() => {
    if (!zustand || !firmenEmail || zustand.einstellungen.email === firmenEmail) return;
    api<GesucheZustand>({ aktion: 'einstellungen', ...zustand.einstellungen, email: firmenEmail })
      .then(setZustand)
      .catch(e => setFehler(e instanceof Error ? e.message : String(e)));
  }, [zustand, firmenEmail, api]);

  const pushAktivieren = async () => {
    setFehler('');
    const hinweis = pushHinweis();
    if (hinweis) return setFehler(hinweis);
    if ((await Notification.requestPermission()) !== 'granted') {
      return setFehler('Benachrichtigungen wurden nicht erlaubt. Das lässt sich in den Browser- bzw. iOS-Einstellungen ändern.');
    }
    const reg = await navigator.serviceWorker.ready;
    const abo =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlZuBytes(zustand!.vapidPublicKey) }));
    await ausfuehren({ aktion: 'push-abo', abo: abo.toJSON() }, () => 'Push ist auf diesem Gerät aktiv.');
    setPushAufGeraet(true);
  };

  if (laeuft === 'laden') {
    return (
      <div className="flex justify-center py-16 text-gray-500">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">Gesuche im Netz</h2>
          <p className="text-xs text-gray-500 mt-1">
            Sucht jeden Morgen automatisch in Foren, auf Reddit und gutefrage.net nach Beiträgen, in denen jemand gerade passende Software sucht.
            Neue Treffer kommen per E-Mail{zustand?.einstellungen.email ? ` an ${zustand.einstellungen.email}` : ''} und als Push-Nachricht.
            Antworten bitte selbst und öffentlich im Thread.
          </p>
          {!firmenEmail && (
            <p className="text-xs text-amber-300 mt-2">Keine Firmen-E-Mail hinterlegt — bitte unter Einstellungen eintragen, sonst kommt keine E-Mail.</p>
          )}
          {zustand?.letzterLauf && (
            <p className="text-xs text-gray-500 mt-2">
              Letzte Suche: {format(new Date(zustand.letzterLauf.am), 'dd.MM.yyyy HH:mm', { locale: de })} —{' '}
              {zustand.letzterLauf.neueUrls} neue Seiten geprüft, {zustand.letzterLauf.neueTreffer} Treffer
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => ausfuehren({ aktion: 'lauf' }, a => (a.neueTreffer ? `${a.neueTreffer} neue Treffer.` : 'Nichts Neues gefunden.'))}
            disabled={laeuft !== null || !zustand}
            className={`${knopfKlasse} bg-primary-600 text-white hover:bg-primary-700`}
          >
            {laeuft === 'lauf' ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
            {laeuft === 'lauf' ? 'Suche läuft… (bis zu 2 Minuten)' : 'Jetzt suchen'}
          </button>
          {pushAufGeraet ? (
            <button
              type="button"
              onClick={() =>
                ausfuehren({ aktion: 'push-test' }, a =>
                  a.zugestellt ? `Test an ${a.zugestellt} Gerät(e) gesendet.` : 'Kein Gerät erreichbar.',
                )
              }
              disabled={laeuft !== null}
              className={`${knopfKlasse} bg-emerald-900/30 text-emerald-200 border border-emerald-800/50 hover:bg-emerald-900/45`}
            >
              {laeuft === 'push-test' ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
              Push aktiv — Test senden
            </button>
          ) : (
            <button
              type="button"
              onClick={pushAktivieren}
              disabled={laeuft !== null || !zustand?.vapidPublicKey}
              className={`${knopfKlasse} bg-dark-700 text-gray-200 border border-dark-600 hover:bg-dark-600`}
            >
              {laeuft === 'push-abo' ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
              Push auf diesem Gerät aktivieren
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setEinstellungenOffen(v => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 inline-flex items-center gap-1"
        >
          Suchanfragen anpassen {einstellungenOffen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {einstellungenOffen && zustand && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Google-Suchanfragen (eine pro Zeile, max. 30). Am besten mit „reddit“, „Forum“ oder „gutefrage“ — sonst kommen fast nur Anbieterseiten. Die aktuelle Jahreszahl wird automatisch angehängt.
              </label>
              <textarea value={suchanfragen} onChange={e => setSuchanfragen(e.target.value)} rows={10} className={eingabeKlasse} />
            </div>
            <div className="sm:max-w-[260px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nur Beiträge aus den letzten</label>
              <select value={tage} onChange={e => setTage(e.target.value)} className={eingabeKlasse}>
                <option value="7">7 Tagen</option>
                <option value="30">30 Tagen</option>
                <option value="90">90 Tagen</option>
                <option value="365">12 Monaten</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() =>
                ausfuehren(
                  { aktion: 'einstellungen', email: firmenEmail, suchanfragen: suchanfragen.split('\n'), tage: Number(tage) },
                  () => 'Gespeichert.',
                )
              }
              disabled={laeuft !== null}
              className={`${knopfKlasse} bg-dark-700 text-gray-200 border border-dark-600 hover:bg-dark-600`}
            >
              {laeuft === 'einstellungen' && <Loader2 size={15} className="animate-spin" />}
              Speichern
            </button>
          </div>
        )}
      </div>

      {fehler && <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-300">{fehler}</div>}
      {meldung && <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-4 text-sm text-emerald-300">{meldung}</div>}

      {zustand &&
        (zustand.treffer.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">Noch keine Treffer. Die Suche läuft jeden Morgen automatisch.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {zustand.treffer.map(t => (
              <TrefferKarte key={t.url} treffer={t} onEntfernen={() => ausfuehren({ aktion: 'treffer-entfernen', url: t.url })} />
            ))}
          </div>
        ))}
    </>
  );
}
