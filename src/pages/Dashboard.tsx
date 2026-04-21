import { useApp } from '../context/AppContext';
import { fmtEur, berechneGesamtsummen } from '../utils/berechnungen';
import { Link } from 'react-router-dom';
import {
  Users,
  Package,
  FileText,
  Receipt,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  Scale,
  Landmark,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Dashboard() {
  const { data } = useApp();
  const { kunden, artikel, dokumente, eingangsrechnungen, firma } = data;

  const angebote = dokumente.filter(d => d.typ === 'angebot');
  const rechnungen = dokumente.filter(d => d.typ === 'rechnung');
  const offeneRechnungen = rechnungen.filter(d => d.status !== 'bezahlt' && d.status !== 'storniert');
  const bezahlteRechnungen = rechnungen.filter(d => d.status === 'bezahlt');
  const umsatz = bezahlteRechnungen.reduce((sum, d) => sum + berechneGesamtsummen(d.positionen).brutto, 0);
  const ausgaben = eingangsrechnungen.reduce((sum, e) => sum + (Number(e.betragBrutto) || 0), 0);
  const gewinn = umsatz - ausgaben;
  const steuerPct = Math.min(100, Math.max(0, Number(firma.dashboardSteuerSchaetzungProzent) || 0));
  const gewinnNachSteuer = gewinn * (1 - steuerPct / 100);
  const offen = offeneRechnungen.reduce((sum, d) => sum + berechneGesamtsummen(d.positionen).brutto, 0);

  const recentDocs = [...dokumente]
    .sort((a, b) => new Date(b.erstelltAm).getTime() - new Date(a.erstelltAm).getTime())
    .slice(0, 5);

  const stats = [
    { label: 'Kunden', value: kunden.length, icon: Users, color: 'bg-blue-900/50 text-blue-300', link: '/kunden' },
    { label: 'Artikel', value: artikel.length, icon: Package, color: 'bg-violet-900/50 text-violet-300', link: '/artikel' },
    { label: 'Angebote', value: angebote.length, icon: FileText, color: 'bg-amber-900/50 text-amber-300', link: '/angebote' },
    { label: 'Rechnungen', value: rechnungen.length, icon: Receipt, color: 'bg-emerald-900/50 text-emerald-300', link: '/rechnungen' },
  ];

  return (
    <div className="page-padding space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-100 break-words">Willkommen, {data.firma.inhaber}!</h1>
        <p className="text-gray-500 mt-1">Hier ist deine aktuelle Übersicht.</p>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/50 flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Umsatz (bezahlt)</p>
              <p className="text-xl font-bold text-gray-100 tabular-nums">{fmtEur(umsatz)}</p>
              <p className="text-xs text-gray-600 mt-1">Summe brutto aus Rechnungen mit Status „bezahlt“.</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-900/50 flex items-center justify-center">
              <TrendingDown size={20} className="text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Ausgaben (Fibu)</p>
              <p className="text-xl font-bold text-gray-100 tabular-nums">{fmtEur(ausgaben)}</p>
              <p className="text-xs text-gray-600 mt-1">
                Summe der Eingangsrechnungen.{' '}
                <Link to="/fibu" className="text-primary-400 hover:underline">Zur Fibu</Link>
              </p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-900/50 flex items-center justify-center">
              <Scale size={20} className="text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Gewinn (Umsatz − Ausgaben)</p>
              <p className={`text-xl font-bold tabular-nums ${gewinn >= 0 ? 'text-gray-100' : 'text-rose-300'}`}>
                {fmtEur(gewinn)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-900/50 flex items-center justify-center">
              <Landmark size={20} className="text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Gewinn nach geschätzter Steuer ({steuerPct.toLocaleString('de-DE')}%)</p>
              <p className={`text-xl font-bold tabular-nums ${gewinnNachSteuer >= 0 ? 'text-gray-100' : 'text-rose-300'}`}>
                {fmtEur(gewinnNachSteuer)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Vereinfacht: Gewinn × (1 − Steuersatz). Anpassbar unter{' '}
                <Link to="/einstellungen" className="text-primary-400 hover:underline">Einstellungen</Link>.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-900/50 flex items-center justify-center">
              <Clock size={20} className="text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Offene Rechnungen</p>
              <p className="text-xl font-bold text-gray-100 tabular-nums">{fmtEur(offen)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ label, value, icon: Icon, color, link }) => (
          <Link
            key={label}
            to={link}
            className="bg-dark-800 rounded-2xl p-5 border border-dark-700 hover:border-dark-200/20 hover:bg-dark-800/80 transition-all"
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-100">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Letzte Dokumente */}
      <div className="bg-dark-800 rounded-2xl border border-dark-700">
        <div className="px-5 py-4 border-b border-dark-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-200">Zuletzt erstellt</h2>
        </div>
        {recentDocs.length === 0 ? (
          <div className="py-12 text-center text-gray-600 text-sm">
            Noch keine Dokumente vorhanden.
          </div>
        ) : (
          <ul className="divide-y divide-dark-700">
            {recentDocs.map(doc => {
              const kunde = kunden.find(k => k.id === doc.kundeId);
              const { brutto } = berechneGesamtsummen(doc.positionen);
              return (
                <li key={doc.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3.5 hover:bg-dark-700/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${doc.typ === 'angebot' ? 'bg-amber-900/50' : 'bg-emerald-900/50'}`}>
                      {doc.typ === 'angebot'
                        ? <FileText size={15} className="text-amber-400" />
                        : <Receipt size={15} className="text-emerald-400" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 break-all">{doc.nummer}</p>
                      <p className="text-xs text-gray-500 break-words">{kunde?.firma || 'Unbekannter Kunde'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-11 sm:pl-0 shrink-0">
                    <span className="text-sm font-semibold text-gray-200 tabular-nums">{fmtEur(brutto)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {format(new Date(doc.erstelltAm), 'dd.MM.yyyy', { locale: de })}
                      </span>
                      {doc.status === 'bezahlt'
                        ? <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                        : doc.status === 'ueberfaellig'
                        ? <AlertCircle size={15} className="text-red-400 shrink-0" />
                        : null
                      }
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
