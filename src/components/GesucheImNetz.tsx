import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Radar } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { GesuchTreffer } from '../types';
import { readApiJson } from '../utils/readApiJson';

/** Kurze Google-Anfragen, eine pro Zeile — lange „Themen“ liefern bei der KI-Suche kaum Treffer. */
const DEFAULT_SUCHANFRAGEN = [
  'reddit Handwerker welche Software nutzt ihr',
  'reddit selbstständig Handwerkersoftware gesucht',
  'gutefrage Software für Handwerker Rechnungen Angebote',
  'Zeiterfassung App Handwerker Erfahrungen Forum',
  'Alternative zu Plancraft',
  'Hero Handwerkersoftware Erfahrungen unzufrieden',
].join('\n');

const eingabeKlasse =
  'w-full min-h-[44px] bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500';

function TrefferKarte({ treffer }: { treffer: GesuchTreffer }) {
  const [kopiert, setKopiert] = useState(false);

  const kopieren = async () => {
    await navigator.clipboard.writeText(treffer.antwortVorschlag);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 1500);
  };

  const scoreFarbe =
    treffer.score >= 70 ? 'bg-emerald-900/40 text-emerald-300' : treffer.score >= 40 ? 'bg-amber-900/30 text-amber-300' : 'bg-dark-700 text-gray-400';

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
            {treffer.quelle}
            {treffer.datum && ` · ${format(new Date(treffer.datum), 'dd.MM.yyyy', { locale: de })}`}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${scoreFarbe}`} title="Wie warm der Kontakt ist (0–100)">
          {treffer.score}
        </span>
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
  const [suchanfragen, setSuchanfragen] = useState(DEFAULT_SUCHANFRAGEN);
  const [tage, setTage] = useState('90');
  const [sucht, setSucht] = useState(false);
  const [fehler, setFehler] = useState('');
  const [ergebnis, setErgebnis] = useState<{ treffer: GesuchTreffer[]; gefunden: number; geladen: number } | null>(null);

  const suchen = async () => {
    setSucht(true);
    setFehler('');
    setErgebnis(null);
    try {
      const res = await fetch('/api/gesuche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suchanfragen: suchanfragen.split('\n'), tage: Number(tage) }),
      });
      const parsed = await readApiJson<{ error?: string; treffer?: GesuchTreffer[]; gefunden?: number; geladen?: number }>(res);
      if (parsed.jsonError) throw new Error(`Unerwartete Server-Antwort (${res.status}).`);
      const body = parsed.data!;
      if (!res.ok) throw new Error(body.error ?? 'Suche fehlgeschlagen');
      setErgebnis({ treffer: body.treffer ?? [], gefunden: body.gefunden ?? 0, geladen: body.geladen ?? 0 });
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
    } finally {
      setSucht(false);
    }
  };

  return (
    <>
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">Gesuche im Netz</h2>
          <p className="text-xs text-gray-500 mt-1">
            Findet öffentliche Beiträge (Foren, Reddit, gutefrage.net, Bewertungsportale), in denen jemand gerade nach so einer Lösung sucht.
            Antworten bitte selbst und öffentlich im Thread — keine Massen-Mails.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Google-Suchanfragen (eine pro Zeile, max. 8)</label>
          <textarea value={suchanfragen} onChange={e => setSuchanfragen(e.target.value)} rows={6} className={eingabeKlasse} />
        </div>
        <div className="sm:max-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Zeitraum</label>
          <select value={tage} onChange={e => setTage(e.target.value)} className={eingabeKlasse}>
            <option value="7">Letzte 7 Tage</option>
            <option value="30">Letzte 30 Tage</option>
            <option value="90">Letzte 90 Tage</option>
            <option value="365">Letztes Jahr</option>
          </select>
        </div>
        <button
          type="button"
          onClick={suchen}
          disabled={sucht || !suchanfragen.trim()}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sucht ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
          {sucht ? 'Durchsuche das Netz… (bis zu 2 Minuten)' : 'Netz durchsuchen'}
        </button>
      </div>

      {fehler && <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-300">{fehler}</div>}

      {ergebnis && (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            {ergebnis.gefunden} Fundstellen, {ergebnis.geladen} davon geladen, {ergebnis.treffer.length} passend
          </p>
          {ergebnis.treffer.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">Diesmal nichts Passendes. Zeitraum vergrößern oder andere Suchanfragen probieren.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ergebnis.treffer.map(t => (
                <TrefferKarte key={t.url} treffer={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
