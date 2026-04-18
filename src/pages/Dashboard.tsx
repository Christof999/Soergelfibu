import { useApp } from '../context/AppContext';
import { fmtEur, berechneGesamtsummen } from '../utils/berechnungen';
import { Link } from 'react-router-dom';
import { Users, Package, FileText, Receipt, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Dashboard() {
  const { data } = useApp();
  const { kunden, artikel, dokumente } = data;

  const angebote = dokumente.filter(d => d.typ === 'angebot');
  const rechnungen = dokumente.filter(d => d.typ === 'rechnung');
  const offeneRechnungen = rechnungen.filter(d => d.status !== 'bezahlt' && d.status !== 'storniert');
  const bezahlteRechnungen = rechnungen.filter(d => d.status === 'bezahlt');
  const umsatz = bezahlteRechnungen.reduce((sum, d) => sum + berechneGesamtsummen(d.positionen).brutto, 0);
  const offen = offeneRechnungen.reduce((sum, d) => sum + berechneGesamtsummen(d.positionen).brutto, 0);

  const recentDocs = [...dokumente]
    .sort((a, b) => new Date(b.erstelltAm).getTime() - new Date(a.erstelltAm).getTime())
    .slice(0, 5);

  const stats = [
    { label: 'Kunden', value: kunden.length, icon: Users, color: 'bg-blue-50 text-blue-600', link: '/kunden' },
    { label: 'Artikel', value: artikel.length, icon: Package, color: 'bg-violet-50 text-violet-600', link: '/artikel' },
    { label: 'Angebote', value: angebote.length, icon: FileText, color: 'bg-amber-50 text-amber-600', link: '/angebote' },
    { label: 'Rechnungen', value: rechnungen.length, icon: Receipt, color: 'bg-emerald-50 text-emerald-600', link: '/rechnungen' },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Willkommen, {data.firma.inhaber}!</h1>
        <p className="text-gray-500 mt-1">Hier ist deine aktuelle Übersicht.</p>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Umsatz (bezahlt)</p>
              <p className="text-xl font-bold text-gray-900">{fmtEur(umsatz)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Clock size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Offene Rechnungen</p>
              <p className="text-xl font-bold text-gray-900">{fmtEur(offen)}</p>
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
            className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Letzte Dokumente */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Zuletzt erstellt</h2>
        </div>
        {recentDocs.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Noch keine Dokumente vorhanden.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentDocs.map(doc => {
              const kunde = kunden.find(k => k.id === doc.kundeId);
              const { brutto } = berechneGesamtsummen(doc.positionen);
              return (
                <li key={doc.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${doc.typ === 'angebot' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                      {doc.typ === 'angebot'
                        ? <FileText size={15} className="text-amber-600" />
                        : <Receipt size={15} className="text-emerald-600" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.nummer}</p>
                      <p className="text-xs text-gray-500">{kunde?.firma || 'Unbekannter Kunde'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-gray-900">{fmtEur(brutto)}</span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(doc.erstelltAm), 'dd.MM.yyyy', { locale: de })}
                    </span>
                    {doc.status === 'bezahlt'
                      ? <CheckCircle size={15} className="text-emerald-500" />
                      : doc.status === 'ueberfaellig'
                      ? <AlertCircle size={15} className="text-red-500" />
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
