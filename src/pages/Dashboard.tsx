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
  Wallet,
  PiggyBank,
  Landmark,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Dashboard() {
  const { data } = useApp();
  const { kunden, artikel, dokumente, firma } = data;
  const eingangsrechnungen = data.eingangsrechnungen ?? [];

  const angebote = dokumente.filter(d => d.typ === 'angebot');
  const rechnungen = dokumente.filter(d => d.typ === 'rechnung');
  const offeneRechnungen = rechnungen.filter(d => d.status !== 'bezahlt' && d.status !== 'storniert');
  const bezahlteRechnungen = rechnungen.filter(d => d.status === 'bezahlt');
  const umsatz = bezahlteRechnungen.reduce((sum, d) => sum + berechneGesamtsummen(d.positionen).brutto, 0);
  const offen = offeneRechnungen.reduce((sum, d) => sum + berechneGesamtsummen(d.positionen).brutto, 0);

  const ausgabenBrutto = eingangsrechnungen.reduce((sum, e) => sum + e.betragBrutto, 0);
  const gewinn = umsatz - ausgabenBrutto;
  const steuerPct = firma.dashboardSteuerSchaetzungProzent ?? 30;
  const geschaetzteSteuer = gewinn > 0 ? gewinn * (steuerPct / 100) : 0;
  const gewinnNachSteuer = gewinn - geschaetzteSteuer;

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
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Willkommen, {data.firma.inhaber}!</h1>
        <p className="text-gray-500 mt-1">Hier ist deine aktuelle Übersicht.</p>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/50 flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Umsatz (bezahlt)</p>
              <p className="text-xl font-bold text-gray-100">{fmtEur(umsatz)}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-900/50 flex items-center justify-center">
              <Clock size={20} className="text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Offene Rechnungen</p>
              <p className="text-xl font-bold text-gray-100">{fmtEur(offen)}</p>
            </div>
          </div>
        </div>
        <Link
          to="/fibu"
          className="bg-dark-800 rounded-2xl p-5 border border-dark-700 hover:border-dark-600 transition-colors block"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-900/50 flex items-center justify-center">
              <Wallet size={20} className="text-rose-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ausgaben (Fibu)</p>
              <p className="text-xl font-bold text-gray-100">{fmtEur(ausgabenBrutto)}</p>
              <p className="text-xs text-gray-600 mt-1">{eingangsrechnungen.length} Belege · Fibu öffnen</p>
            </div>
          </div>
        </Link>
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-900/50 flex items-center justify-center">
              <PiggyBank size={20} className="text-sky-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Gewinn (Umsatz − Ausgaben)</p>
              <p className="text-xl font-bold text-gray-100">{fmtEur(gewinn)}</p>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700 sm:col-span-2 xl:col-span-3">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Landmark size={20} className="text-indigo-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Gewinn nach geschätzter Steuer ({steuerPct}% auf Gewinn)</p>
              <p className="text-xl font-bold text-gray-100">{fmtEur(gewinnNachSteuer)}</p>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                {gewinn <= 0
                  ? 'Bei Verlust oder ausgeglichen ist die geschätzte Steuerlast hier 0 € (keine zusätzliche „Erstattung“ im Dashboard).'
                  : `Geschätzte Steuer auf den Gewinn: ${fmtEur(geschaetzteSteuer)}. Nur eine grobe Orientierung — Steuersatz in den Einstellungen anpassbar.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
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
                <li key={doc.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-dark-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${doc.typ === 'angebot' ? 'bg-amber-900/50' : 'bg-emerald-900/50'}`}>
                      {doc.typ === 'angebot'
                        ? <FileText size={15} className="text-amber-400" />
                        : <Receipt size={15} className="text-emerald-400" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{doc.nummer}</p>
                      <p className="text-xs text-gray-500">{kunde?.firma || 'Unbekannter Kunde'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-gray-200">{fmtEur(brutto)}</span>
                    <span className="text-xs text-gray-600">
                      {format(new Date(doc.erstelltAm), 'dd.MM.yyyy', { locale: de })}
                    </span>
                    {doc.status === 'bezahlt'
                      ? <CheckCircle size={15} className="text-emerald-400" />
                      : doc.status === 'ueberfaellig'
                      ? <AlertCircle size={15} className="text-red-400" />
                      : null
                    }
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
