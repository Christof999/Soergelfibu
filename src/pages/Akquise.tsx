import { useState } from 'react';
import {
  Search, Star, Globe, Phone, Mail, MapPin, Loader2,
  Sparkles, ChevronDown, ChevronUp, ExternalLink, Trash2,
  TrendingUp, Users, FileText,
} from 'lucide-react';
import EmailModal from '../components/EmailModal';
import PageHeader from '../components/PageHeader';
import { useApp } from '../context/AppContext';
import { Lead, LeadAnalyse } from '../types';
import type { AkquiseEmailTemplateKind } from '../utils/emailTemplate';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function Sterne({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={11}
          className={i < Math.round(n) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}
        />
      ))}
      <span className="text-xs text-gray-500 ml-1">{n.toFixed(1)}</span>
    </span>
  );
}

// ─── Lead-Karte ──────────────────────────────────────────────────────────────

function LeadKarte({
  lead,
  onStern,
  onAnalyse,
  onDelete,
  analysierend,
  onEmailAnalyse,
  onEmailStandard,
}: {
  lead: Lead;
  onStern: () => void;
  onAnalyse: () => void;
  onDelete?: () => void;
  analysierend: boolean;
  onEmailAnalyse?: () => void;
  onEmailStandard?: () => void;
}) {
  const [offen, setOffen] = useState(false);

  return (
    <div className={`bg-dark-800 border rounded-2xl overflow-hidden transition-all ${
      lead.stern ? 'border-amber-600/50' : 'border-dark-700'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-100 truncate">{lead.name}</h3>
              {lead.branche && (
                <span className="shrink-0 text-xs px-2 py-0.5 bg-dark-700 text-gray-400 rounded-full">{lead.branche.replace(/_/g, ' ')}</span>
              )}
            </div>
            <div className="space-y-0.5 text-xs text-gray-500">
              {lead.adresse && <p className="flex items-center gap-1.5"><MapPin size={10} />{lead.adresse}</p>}
              {lead.telefon && <p className="flex items-center gap-1.5"><Phone size={10} /><a href={`tel:${lead.telefon}`} className="hover:text-primary-400">{lead.telefon}</a></p>}
              {lead.website && (
                <p className="flex items-center gap-1.5">
                  <Globe size={10} />
                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary-400 truncate max-w-[220px] flex items-center gap-1">
                    {lead.website.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink size={9} />
                  </a>
                </p>
              )}
              {lead.email && <p className="flex items-center gap-1.5"><Mail size={10} /><a href={`mailto:${lead.email}`} className="hover:text-primary-400">{lead.email}</a></p>}
              {lead.bewertung > 0 && <div className="mt-1"><Sterne n={lead.bewertung} /> <span className="text-gray-600 text-xs">({lead.bewertungsAnzahl})</span></div>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={onStern}
              className={`p-1.5 rounded-lg transition-colors ${
                lead.stern
                  ? 'text-amber-400 bg-amber-900/30 hover:bg-amber-900/50'
                  : 'text-gray-600 hover:text-amber-400 hover:bg-amber-900/20'
              }`}
              title={lead.stern ? 'Als potentiellen Kunden entfernen' : 'Als potentiellen Kunden markieren'}
            >
              <Star size={15} className={lead.stern ? 'fill-amber-400' : ''} />
            </button>
            {onDelete && (
              <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Analyse-Bereich */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {!lead.analyse ? (
              <button
                type="button"
                onClick={onAnalyse}
                disabled={analysierend || !lead.website}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-600/20 text-primary-300 border border-primary-700/50 rounded-lg hover:bg-primary-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={!lead.website ? 'Keine Website vorhanden' : ''}
              >
                {analysierend ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {analysierend ? 'Analysiere…' : 'KI-Analyse'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOffen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-900/20 border border-emerald-800/50 rounded-lg hover:bg-emerald-900/30 transition-colors"
              >
                <Sparkles size={11} />
                Analyse anzeigen
                {offen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
            {onEmailStandard && lead.email && (
              <button
                type="button"
                onClick={onEmailStandard}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-dark-700 text-gray-300 border border-dark-600 rounded-lg hover:bg-dark-600 hover:text-gray-100 transition-colors"
                title="Standard-E-Mail ohne KI (Leistungen & Branding)"
              >
                <FileText size={11} />
                Standard-E-Mail
              </button>
            )}
            {onEmailAnalyse && lead.email && lead.analyse && (
              <button
                type="button"
                onClick={onEmailAnalyse}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-700/30 text-primary-200 border border-primary-600/40 rounded-lg hover:bg-primary-700/45 transition-colors"
                title="E-Mail mit den drei Analyse-Punkten"
              >
                <Mail size={11} />
                E-Mail (Analyse)
              </button>
            )}
          </div>
        </div>

        {/* Analyse-Details */}
        {lead.analyse && offen && (
          <div className="mt-3 pt-3 border-t border-dark-700 space-y-3">
            {lead.analyse.zusammenfassung && (
              <p className="text-xs text-gray-400 italic">{lead.analyse.zusammenfassung}</p>
            )}
            {lead.analyse.ansprechpartner && (
              <div className="flex items-center gap-2 text-xs">
                <Users size={12} className="text-primary-400 shrink-0" />
                <span className="text-gray-400">Ansprechpartner: <span className="text-gray-200 font-medium">{lead.analyse.ansprechpartner}</span></span>
              </div>
            )}
            {lead.analyse.optimierungen.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <TrendingUp size={11} /> Optimierungspotenziale
                </p>
                <ul className="space-y-1.5">
                  {lead.analyse.optimierungen.map((opt, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-primary-700/50 text-primary-300 flex items-center justify-center text-xs font-bold mt-0.5">{i + 1}</span>
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lead.analyse.websiteGeladen === false && (
              <div className="flex items-start gap-1.5 px-3 py-2 bg-amber-900/20 border border-amber-800/40 rounded-lg text-xs text-amber-300">
                <span className="shrink-0 mt-0.5">⚠</span>
                Website konnte nicht automatisch geladen werden (Bot-Schutz o.ä.) – Analyse basiert nur auf Name und Branche. Ergebnisse können ungenau sein.
              </div>
            )}
            <p className="text-xs text-gray-600">
              Analysiert am {format(new Date(lead.analyse.analysiertAm), 'dd.MM.yyyy HH:mm', { locale: de })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

type Ansicht = 'suche' | 'potentiell';

export default function Akquise() {
  const { data, upsertLead, deleteLead } = useApp();

  const [ansicht, setAnsicht] = useState<Ansicht>('suche');
  const [emailModal, setEmailModal] = useState<{ lead: Lead; mode: AkquiseEmailTemplateKind } | null>(null);
  const [query, setQuery] = useState('');
  const [plz, setPlz] = useState('91732');
  const [radius, setRadius] = useState('50');
  const [sucht, setSucht] = useState(false);
  const [suchergebnisse, setSuchergebnisse] = useState<Lead[]>([]);
  const [suchfehler, setSuchfehler] = useState('');
  const [analysierend, setAnalysierend] = useState<Record<string, boolean>>({});

  const potentielle = (data.leads ?? []).filter(l => l.stern);

  const suchen = async () => {
    if (!query.trim()) return;
    setSucht(true);
    setSuchfehler('');
    setSuchergebnisse([]);
    try {
      const res = await fetch('/api/akquise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), plz, radius: parseInt(radius) * 1000 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unbekannter Fehler');
      const leads: Lead[] = (data.ergebnisse ?? []).map((e: Omit<Lead, 'id' | 'analyse' | 'stern' | 'erstelltAm'>) => ({
        ...e,
        id: uuidv4(),
        analyse: null,
        stern: false,
        erstelltAm: new Date().toISOString(),
      }));
      setSuchergebnisse(leads);
    } catch (err) {
      setSuchfehler(String(err));
    } finally {
      setSucht(false);
    }
  };

  const toggleStern = async (lead: Lead) => {
    const updated = { ...lead, stern: !lead.stern };
    // Im Suchergebnis aktualisieren
    setSuchergebnisse(prev => prev.map(l => l.id === lead.id ? updated : l));
    // In Firestore speichern wenn gestern, sonst löschen
    if (updated.stern) {
      await upsertLead(updated);
    } else {
      await deleteLead(lead.id);
    }
  };

  const toggleSternPotentiell = async (lead: Lead) => {
    const updated = { ...lead, stern: false };
    await upsertLead(updated); // Stern entfernen aber behalten oder
    await deleteLead(lead.id); // direkt löschen
  };

  const analysieren = async (lead: Lead, isFromPotentiell = false) => {
    setAnalysierend(prev => ({ ...prev, [lead.id]: true }));
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: lead.website, name: lead.name, branche: lead.branche }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analyse fehlgeschlagen');
      const analyse: LeadAnalyse = data;
      const updated = { ...lead, analyse };
      setSuchergebnisse(prev => prev.map(l => l.id === lead.id ? updated : l));
      if (isFromPotentiell || lead.stern) await upsertLead(updated);
    } catch (err) {
      alert(`Analyse fehlgeschlagen: ${err}`);
    } finally {
      setAnalysierend(prev => ({ ...prev, [lead.id]: false }));
    }
  };

  return (
    <div>
      <PageHeader
        title="Akquise"
        subtitle="Neue Kunden in deiner Region finden und analysieren"
      />

      {/* Tab-Leiste */}
      <div className="flex gap-1 px-8 pt-4 pb-0 border-b border-dark-700">
        {([
          { id: 'suche', label: 'Suche & Entdecken' },
          { id: 'potentiell', label: `Potentielle Kunden${potentielle.length > 0 ? ` (${potentielle.length})` : ''}` },
        ] as { id: Ansicht; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setAnsicht(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              ansicht === t.id
                ? 'border-primary-500 text-primary-300 bg-dark-800'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-8 space-y-6">

        {/* ── Suche ── */}
        {ansicht === 'suche' && (
          <>
            {/* Suchformular */}
            <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-300">Unternehmen finden</h2>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-5">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Branche / Suchbegriff</label>
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && suchen()}
                    placeholder="z.B. Bäckerei, Zahnarzt, Autohaus…"
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">PLZ</label>
                  <input
                    value={plz}
                    onChange={e => setPlz(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Umkreis (km)</label>
                  <select
                    value={radius}
                    onChange={e => setRadius(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="10">10 km</option>
                    <option value="25">25 km</option>
                    <option value="50">50 km</option>
                    <option value="75">75 km</option>
                    <option value="100">100 km</option>
                  </select>
                </div>
                <div className="col-span-3 flex items-end">
                  <button
                    onClick={suchen}
                    disabled={sucht || !query.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sucht ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    {sucht ? 'Suche läuft…' : 'Suchen'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Tip: Markiere interessante Einträge mit ★ — sie landen dann in „Potentielle Kunden".
              </p>
            </div>

            {/* Fehler */}
            {suchfehler && (
              <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-300">
                {suchfehler}
              </div>
            )}

            {/* Ergebnisse */}
            {suchergebnisse.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-3">{suchergebnisse.length} Ergebnisse gefunden</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {suchergebnisse.map(lead => (
                    <LeadKarte
                      key={lead.id}
                      lead={lead}
                      onStern={() => toggleStern(lead)}
                      onAnalyse={() => analysieren(lead)}
                      analysierend={!!analysierend[lead.id]}
                      onEmailStandard={() => setEmailModal({ lead, mode: 'standard' })}
                      onEmailAnalyse={() => setEmailModal({ lead, mode: 'analyse' })}
                    />
                  ))}
                </div>
              </div>
            )}

            {!sucht && suchergebnisse.length === 0 && !suchfehler && (
              <div className="text-center py-16 text-gray-600">
                <Search size={44} strokeWidth={1.2} className="mx-auto mb-4" />
                <p className="text-sm">Gib einen Suchbegriff ein und klicke auf Suchen.</p>
              </div>
            )}
          </>
        )}

        {/* ── Potentielle Kunden ── */}
        {ansicht === 'potentiell' && (
          <>
            {potentielle.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <Star size={44} strokeWidth={1.2} className="mx-auto mb-4" />
                <p className="text-sm">Noch keine potentiellen Kunden markiert.</p>
                <p className="text-xs mt-1">Markiere Einträge mit ★ in der Suche.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {potentielle
                  .slice()
                  .sort((a, b) => new Date(b.erstelltAm).getTime() - new Date(a.erstelltAm).getTime())
                  .map(lead => (
                    <div key={lead.id} className="space-y-2">
                      <LeadKarte
                        lead={lead}
                        onStern={() => toggleSternPotentiell(lead)}
                        onAnalyse={() => analysieren(lead, true)}
                        onDelete={() => deleteLead(lead.id)}
                        analysierend={!!analysierend[lead.id]}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEmailModal({ lead, mode: 'analyse' })}
                          disabled={!lead.analyse}
                          className="flex items-center justify-center gap-2 px-4 py-2 w-full text-sm font-medium bg-primary-600/20 border border-primary-700/50 text-primary-200 rounded-xl hover:bg-primary-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={!lead.analyse ? 'Zuerst KI-Analyse ausführen' : ''}
                        >
                          <Sparkles size={14} /> Mit Analyse
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailModal({ lead, mode: 'standard' })}
                          className="flex items-center justify-center gap-2 px-4 py-2 w-full text-sm font-medium bg-dark-800 border border-dark-700 text-gray-300 rounded-xl hover:bg-dark-700 hover:text-gray-100 transition-colors"
                        >
                          <FileText size={14} /> Standard
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {emailModal && (
        <EmailModal
          key={`${emailModal.lead.id}-${emailModal.mode}`}
          lead={emailModal.lead}
          emailMode={emailModal.mode}
          onClose={() => setEmailModal(null)}
        />
      )}
    </div>
  );
}
