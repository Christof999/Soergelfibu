import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, Download, Search, FileText } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import type { ServiceVertrag, ServiceVertragIntervall } from '../types';
import { generateServicevertragPDF } from '../utils/pdf';
import { fmtEur } from '../utils/berechnungen';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type FormData = Omit<ServiceVertrag, 'id' | 'erstelltAm' | 'geaendertAm'>;

function defaultEndDate(startIso: string): string {
  const [y, m, d] = startIso.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setFullYear(dt.getFullYear() + 1);
  return dt.toISOString().slice(0, 10);
}

const STATUS_OPTS: { value: ServiceVertrag['status']; label: string }[] = [
  { value: 'entwurf', label: 'Entwurf' },
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'gekuendigt', label: 'Gekündigt' },
  { value: 'beendet', label: 'Beendet' },
];

const INTERVALL_OPTS: { value: ServiceVertragIntervall; label: string }[] = [
  { value: 'monatlich', label: 'Monatlich' },
  { value: 'quartalsweise', label: 'Quartalsweise' },
  { value: 'jaehrlich', label: 'Jährlich' },
];

export default function ServiceVertraege() {
  const { data, addServiceVertrag, updateServiceVertrag, deleteServiceVertrag } = useApp();
  const liste = useMemo(() => data.serviceVertraege ?? [], [data.serviceVertraege]);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceVertrag | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      kundeId: '',
      titel: '',
      betragNetto: 75,
      intervall: 'monatlich',
      mwstSatz: 19,
      beginnAm: today,
      endeAm: defaultEndDate(today),
      kuendigungsfristMonate: 3,
      leistungen:
        'Hosting / Server-Betrieb, technische Wartung, Sicherheits-Updates, Support nach Vereinbarung (Reaktionszeiten und Umfang im Einzelfall).',
      bedingungen:
        'Zahlung per SEPA-Lastschrift oder Rechnung mit Zahlungsziel 14 Tage, sofern nicht anders vereinbart. Änderungen der Leistungen nach gesonderter Absprache.',
      status: 'entwurf',
    },
  });

  const filtered = liste.filter(v => {
    const k = data.kunden.find(x => x.id === v.kundeId);
    return [v.titel, k?.firma, k?.ansprechpartner].some(t => t?.toLowerCase().includes(search.toLowerCase()));
  });

  const openCreate = () => {
    setEditing(null);
    reset({
      kundeId: '',
      titel: '',
      betragNetto: 75,
      intervall: 'monatlich',
      mwstSatz: 19,
      beginnAm: today,
      endeAm: defaultEndDate(today),
      kuendigungsfristMonate: 3,
      leistungen:
        'Hosting / Server-Betrieb, technische Wartung, Sicherheits-Updates, Support nach Vereinbarung.',
      bedingungen:
        'Zahlung per SEPA-Lastschrift oder Rechnung mit Zahlungsziel 14 Tage, sofern nicht anders vereinbart.',
      status: 'entwurf',
    });
    setModalOpen(true);
  };

  const openEdit = (v: ServiceVertrag) => {
    setEditing(v);
    reset({
      kundeId: v.kundeId,
      titel: v.titel,
      betragNetto: v.betragNetto,
      intervall: v.intervall,
      mwstSatz: v.mwstSatz,
      beginnAm: v.beginnAm.slice(0, 10),
      endeAm: v.endeAm.slice(0, 10),
      kuendigungsfristMonate: v.kuendigungsfristMonate,
      leistungen: v.leistungen,
      bedingungen: v.bedingungen,
      status: v.status,
    });
    setModalOpen(true);
  };

  const onSubmit = async (form: FormData) => {
    if (editing) {
      await updateServiceVertrag({ ...editing, ...form });
    } else {
      await addServiceVertrag(form);
    }
    setModalOpen(false);
  };

  const handlePdf = (v: ServiceVertrag) => {
    const kunde = data.kunden.find(k => k.id === v.kundeId);
    if (!kunde) return alert('Kunde nicht gefunden.');
    generateServicevertragPDF(v, data.firma, kunde);
  };

  const kundeName = (v: ServiceVertrag) => data.kunden.find(k => k.id === v.kundeId)?.firma || '–';
  const intervallLabel = (v: ServiceVertrag) => INTERVALL_OPTS.find(o => o.value === v.intervall)?.label ?? v.intervall;
  const statusLabel = (v: ServiceVertrag) => STATUS_OPTS.find(s => s.value === v.status)?.label;
  // Ende darf leer sein (unbefristet); new Date('') ließ die ganze Seite abstürzen.
  const datumKurz = (iso: string) => (iso ? format(new Date(iso), 'dd.MM.yy', { locale: de }) : '');
  const laufzeit = (v: ServiceVertrag) => `${datumKurz(v.beginnAm)} – ${datumKurz(v.endeAm) || 'unbefristet'}`;

  const aktionen = (v: ServiceVertrag) => (
    <>
      <button
        type="button"
        onClick={() => handlePdf(v)}
        title="PDF Zusammenfassung"
        aria-label={`${v.titel}: PDF`}
        className="p-3 md:p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors"
      >
        <Download size={20} className="md:w-3.5 md:h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => openEdit(v)}
        title="Bearbeiten"
        aria-label={`${v.titel} bearbeiten`}
        className="p-3 md:p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors"
      >
        <Pencil size={20} className="md:w-3.5 md:h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setDeleteId(v.id)}
        title="Löschen"
        aria-label={`${v.titel} löschen`}
        className="p-3 md:p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
      >
        <Trash2 size={20} className="md:w-3.5 md:h-3.5" />
      </button>
    </>
  );

  const inputCls =
    'w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div>
      <PageHeader
        title="Serviceverträge"
        subtitle="Hosting, Betreuung, laufende Services – mit PDF-Zusammenfassung zur Unterschrift."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> Neuer Vertrag
          </button>
        }
      />

      <div className="p-4 sm:p-8 space-y-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen nach Titel, Kunde…"
            className="w-full pl-9 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-dark-800 rounded-2xl border border-dark-700 py-16 flex flex-col items-center gap-3 text-gray-600">
            <FileText size={36} strokeWidth={1.2} />
            <p className="text-sm">{search ? 'Keine Ergebnisse.' : 'Noch keine Serviceverträge.'}</p>
          </div>
        ) : (
          <>
          <div className="hidden md:block bg-dark-800 rounded-2xl border border-dark-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-900/60 text-left border-b border-dark-700">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Titel</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Kunde</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Intervall</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Netto / Zeitraum</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Laufzeit</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-dark-700/50 transition-colors">
                    <td className="px-5 py-3 text-gray-200 max-w-xs">{v.titel}</td>
                    <td className="px-5 py-3 text-gray-400">{kundeName(v)}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{intervallLabel(v)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-200 tabular-nums">{fmtEur(v.betragNetto)}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{laufzeit(v)}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{statusLabel(v)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">{aktionen(v)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden bg-dark-800 rounded-2xl border border-dark-700 divide-y divide-dark-700 overflow-hidden">
            {filtered.map(v => (
              <li key={v.id} className="p-4 space-y-2">
                <button type="button" onClick={() => openEdit(v)} className="w-full min-h-11 text-left space-y-1 [overflow-wrap:anywhere]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-gray-100">{v.titel}</p>
                    <p className="shrink-0 font-semibold text-gray-200 tabular-nums">{fmtEur(v.betragNetto)}</p>
                  </div>
                  <p className="text-sm text-gray-400">{kundeName(v)}</p>
                  <p className="text-xs text-gray-500">{intervallLabel(v)} · {laufzeit(v)}</p>
                </button>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-400">{statusLabel(v)}</span>
                  <div className="flex items-center gap-1 shrink-0">{aktionen(v)}</div>
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Vertrag bearbeiten' : 'Neuer Servicevertrag'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Kunde *</label>
              <select {...register('kundeId', { required: true })} className={inputCls}>
                <option value="">– Kunde wählen –</option>
                {data.kunden.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.firma || k.ansprechpartner} ({k.kundennummer})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Titel *</label>
              <input {...register('titel', { required: true })} placeholder="z. B. Hosting & Betreuung Website …" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Netto je Abrechnungszeitraum (€) *</label>
              <input type="number" step="0.01" min="0" {...register('betragNetto', { valueAsNumber: true })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Intervall</label>
              <select {...register('intervall')} className={inputCls}>
                {INTERVALL_OPTS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">MwSt. (%)</label>
              <select {...register('mwstSatz', { valueAsNumber: true })} className={inputCls}>
                <option value={19}>19%</option>
                <option value={7}>7%</option>
                <option value={0}>0%</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select {...register('status')} className={inputCls}>
                {STATUS_OPTS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Beginn</label>
              <input type="date" {...register('beginnAm')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ende</label>
              <input type="date" {...register('endeAm')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Kündigungsfrist (Monate)</label>
              <input type="number" min={0} {...register('kuendigungsfristMonate', { valueAsNumber: true })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Leistungen *</label>
            <textarea {...register('leistungen', { required: true })} rows={4} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Bedingungen / Zahlung</label>
            <textarea {...register('bedingungen')} rows={3} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700">
              Abbrechen
            </button>
            <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700">
              Speichern
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteServiceVertrag(deleteId)}
        title="Vertrag löschen?"
        message="Der Eintrag wird unwiderruflich entfernt."
      />
    </div>
  );
}
