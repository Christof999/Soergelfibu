import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Plus,
  Pencil,
  Trash2,
  FileDown,
  FileText,
  Loader2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { storage } from '../firebase/config';
import { fmtEur } from '../utils/berechnungen';
import type { Eingangsrechnung } from '../types';

type FormValues = {
  lieferant: string;
  rechnungsnummer: string;
  betragBrutto: string;
  faelligAm: string;
  notizen: string;
};

function monatKeyAus(e: Eingangsrechnung): string {
  const d = e.faelligAm?.trim() ? e.faelligAm : e.erstelltAm;
  const iso = d.slice(0, 10);
  return iso.length >= 7 ? iso.slice(0, 7) : format(new Date(), 'yyyy-MM');
}

function csvEscape(s: string): string {
  const t = String(s ?? '');
  if (/[",;\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function downloadCsv(rows: Eingangsrechnung[], monatLabel: string) {
  const header = ['Lieferant', 'Rechnungsnr.', 'Betrag brutto (EUR)', 'Fällig am', 'Notizen', 'Erfasst am', 'PDF-URL'];
  const lines = [
    header.join(';'),
    ...rows.map(r =>
      [
        csvEscape(r.lieferant),
        csvEscape(r.rechnungsnummer),
        String(r.betragBrutto).replace('.', ','),
        csvEscape(r.faelligAm),
        csvEscape(r.notizen),
        csvEscape(r.erstelltAm),
        csvEscape(r.pdfUrl ?? ''),
      ].join(';')
    ),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `eingangsrechnungen_${monatLabel}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function FibuFormModal({
  open,
  onClose,
  editing,
  userId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Eingangsrechnung | null;
  userId: string;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const draftIdRef = useRef<string | null>(null);
  if (!isEdit && open && !draftIdRef.current) draftIdRef.current = uuidv4();
  if (!open) draftIdRef.current = null;

  const targetId = isEdit ? editing!.id : draftIdRef.current ?? uuidv4();

  const { addEingangsrechnung, updateEingangsrechnung } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      lieferant: '',
      rechnungsnummer: '',
      betragBrutto: '',
      faelligAm: '',
      notizen: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setFile(null);
    if (editing) {
      reset({
        lieferant: editing.lieferant,
        rechnungsnummer: editing.rechnungsnummer,
        betragBrutto: String(editing.betragBrutto),
        faelligAm: editing.faelligAm?.slice(0, 10) ?? '',
        notizen: editing.notizen ?? '',
      });
    } else {
      reset({
        lieferant: '',
        rechnungsnummer: '',
        betragBrutto: '',
        faelligAm: '',
        notizen: '',
      });
    }
  }, [open, editing, reset]);

  const readFileBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = r.result as string;
        const i = s.indexOf('base64,');
        resolve(i >= 0 ? s.slice(i + 7) : s);
      };
      r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
      r.readAsDataURL(f);
    });

  const handleExtract = async () => {
    if (!file) {
      setSaveError('Bitte zuerst eine PDF-Datei wählen.');
      return;
    }
    setExtracting(true);
    setSaveError(null);
    try {
      const b64 = await readFileBase64(file);
      const res = await fetch('/api/extract-eingangsrechnung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: b64, mimeType: file.type || 'application/pdf' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraktion fehlgeschlagen');
      if (data.lieferant) setValue('lieferant', data.lieferant);
      if (data.rechnungsnummer) setValue('rechnungsnummer', data.rechnungsnummer);
      if (typeof data.betragBrutto === 'number' && !Number.isNaN(data.betragBrutto)) {
        setValue('betragBrutto', String(data.betragBrutto));
      }
      if (data.faelligAm) setValue('faelligAm', data.faelligAm.slice(0, 10));
      if (data.notizen) setValue('notizen', data.notizen);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setExtracting(false);
    }
  };

  const onSubmit = async (vals: FormValues) => {
    setSaveError(null);
    const lieferant = vals.lieferant.trim();
    const rechnungsnummer = vals.rechnungsnummer.trim();
    const betrag = parseFloat(String(vals.betragBrutto).replace(',', '.'));
    const faelligAm = vals.faelligAm.trim();

    if (!lieferant) {
      setError('lieferant', { message: 'Pflichtfeld' });
      return;
    }
    if (!rechnungsnummer) {
      setError('rechnungsnummer', { message: 'Pflichtfeld' });
      return;
    }
    if (Number.isNaN(betrag) || betrag <= 0) {
      setError('betragBrutto', { message: 'Gültigen Betrag eingeben' });
      return;
    }
    if (!faelligAm) {
      setError('faelligAm', { message: 'Pflichtfeld' });
      return;
    }

    setSaving(true);
    try {
      let pdfUrl = editing?.pdfUrl;
      let pdfStoragePath = editing?.pdfStoragePath;

      if (file) {
        const path = `fibu/${userId}/${targetId}.pdf`;
        const sref = ref(storage, path);
        await uploadBytes(sref, file, { contentType: file.type || 'application/pdf' });
        pdfUrl = await getDownloadURL(sref);
        pdfStoragePath = path;
      }

      if (isEdit && editing) {
        await updateEingangsrechnung({
          ...editing,
          lieferant,
          rechnungsnummer,
          betragBrutto: betrag,
          faelligAm,
          notizen: vals.notizen.trim(),
          pdfUrl,
          pdfStoragePath,
        });
      } else {
        await addEingangsrechnung({
          id: targetId,
          lieferant,
          rechnungsnummer,
          betragBrutto: betrag,
          faelligAm,
          notizen: vals.notizen.trim(),
          pdfUrl,
          pdfStoragePath,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('storage/unauthorized')) {
        setSaveError(
          'Firebase Storage: keine Berechtigung. In den Storage-Regeln muss `fibu/{userId}/**` für angemeldete Nutzer erlaubt sein.'
        );
      } else {
        setSaveError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Eingangsrechnung bearbeiten' : 'Neue Eingangsrechnung'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {saveError && (
          <div className="rounded-xl border border-red-800/80 bg-red-950/40 px-3 py-2 text-sm text-red-200">{saveError}</div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1">PDF (optional, KI-Auslesen)</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="file"
              accept="application/pdf"
              className="block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-dark-700 file:px-3 file:py-2 file:text-gray-200"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={!file || extracting}
              onClick={() => void handleExtract()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 shrink-0"
            >
              {extracting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Mit KI auslesen
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Nach dem Auslesen Felder prüfen und speichern. PDF wird beim Speichern hochgeladen.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Lieferant *</label>
            <input {...register('lieferant')} className="w-full rounded-xl bg-dark-900 border border-dark-600 px-3 py-2 text-sm text-gray-100" />
            {errors.lieferant && <p className="text-xs text-red-400 mt-0.5">{errors.lieferant.message}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rechnungsnr. *</label>
            <input {...register('rechnungsnummer')} className="w-full rounded-xl bg-dark-900 border border-dark-600 px-3 py-2 text-sm text-gray-100" />
            {errors.rechnungsnummer && <p className="text-xs text-red-400 mt-0.5">{errors.rechnungsnummer.message}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Betrag brutto (EUR) *</label>
            <input
              inputMode="decimal"
              {...register('betragBrutto')}
              className="w-full rounded-xl bg-dark-900 border border-dark-600 px-3 py-2 text-sm text-gray-100 tabular-nums"
            />
            {errors.betragBrutto && <p className="text-xs text-red-400 mt-0.5">{errors.betragBrutto.message}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fällig am *</label>
            <input type="date" {...register('faelligAm')} className="w-full rounded-xl bg-dark-900 border border-dark-600 px-3 py-2 text-sm text-gray-100" />
            {errors.faelligAm && <p className="text-xs text-red-400 mt-0.5">{errors.faelligAm.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Notizen</label>
            <textarea {...register('notizen')} rows={2} className="w-full rounded-xl bg-dark-900 border border-dark-600 px-3 py-2 text-sm text-gray-100" />
          </div>
        </div>

        {editing?.pdfUrl && (
          <a
            href={editing.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary-400 hover:underline"
          >
            <ExternalLink size={14} /> Aktuelles PDF öffnen
          </a>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-dark-600 px-4 py-2 text-sm text-gray-300 hover:bg-dark-700 w-full sm:w-auto">
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 w-full sm:w-auto inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Fibu() {
  const { user } = useAuth();
  const { data, deleteEingangsrechnung } = useApp();
  const liste = useMemo(() => data.eingangsrechnungen ?? [], [data.eingangsrechnungen]);

  const monate = useMemo(() => {
    const set = new Set<string>();
    liste.forEach(e => set.add(monatKeyAus(e)));
    return [...set].sort().reverse();
  }, [liste]);

  const [monat, setMonat] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  useEffect(() => {
    if (monate.length && !monate.includes(monat)) setMonat(monate[0]);
  }, [monate, monat]);

  const imMonat = useMemo(() => liste.filter(e => monatKeyAus(e) === monat), [liste, monat]);
  const summeMonat = useMemo(() => imMonat.reduce((s, e) => s + e.betragBrutto, 0), [imMonat]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Eingangsrechnung | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const openNew = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((e: Eingangsrechnung) => {
    setEditing(e);
    setModalOpen(true);
  }, []);

  const monatLabel = useMemo(() => {
    try {
      return format(parseISO(`${monat}-01`), 'MMMM yyyy', { locale: de });
    } catch {
      return monat;
    }
  }, [monat]);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="Fibu — Eingangsrechnungen"
        subtitle="PDF hochladen, KI extrahiert Daten, vor dem Speichern prüfen."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadCsv(imMonat, monat)}
              disabled={imMonat.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-dark-600 px-4 py-2 text-sm text-gray-200 hover:bg-dark-700 disabled:opacity-40"
            >
              <FileDown size={16} />
              CSV ({monat})
            </button>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white"
            >
              <Plus size={16} />
              Neu
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Monat</label>
            <select
              value={monat}
              onChange={e => setMonat(e.target.value)}
              className="rounded-xl bg-dark-800 border border-dark-600 px-3 py-2 text-sm text-gray-100 min-w-[200px]"
            >
              {monate.length === 0 ? (
                <option value={monat}>{monatLabel}</option>
              ) : (
                monate.map(m => (
                  <option key={m} value={m}>
                    {format(parseISO(`${m}-01`), 'MMMM yyyy', { locale: de })}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="rounded-xl bg-dark-800 border border-dark-700 px-4 py-3 flex-1 max-w-md">
            <p className="text-xs text-gray-500">Summe brutto ({monatLabel})</p>
            <p className="text-lg font-semibold text-gray-100 tabular-nums">{fmtEur(summeMonat)}</p>
          </div>
        </div>

        {imMonat.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dark-600 py-16 text-center text-gray-500 text-sm">
            Keine Eingangsrechnungen in diesem Monat. „Neu“ wählen oder einen anderen Monat.
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-dark-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Lieferant</th>
                    <th className="px-4 py-3 font-medium">Rechnungsnr.</th>
                    <th className="px-4 py-3 font-medium text-right">Brutto</th>
                    <th className="px-4 py-3 font-medium">Fällig</th>
                    <th className="px-4 py-3 font-medium w-28">PDF</th>
                    <th className="px-4 py-3 font-medium text-right w-32">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {imMonat.map(e => (
                    <tr key={e.id} className="hover:bg-dark-800/50">
                      <td className="px-4 py-3 text-gray-200">{e.lieferant}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{e.rechnungsnummer}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-100">{fmtEur(e.betragBrutto)}</td>
                      <td className="px-4 py-3 text-gray-400">{e.faelligAm ? format(parseISO(e.faelligAm.slice(0, 10)), 'dd.MM.yyyy') : '—'}</td>
                      <td className="px-4 py-3">
                        {e.pdfUrl ? (
                          <a href={e.pdfUrl} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline inline-flex items-center gap-1">
                            <FileText size={14} /> PDF
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button type="button" onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-gray-400 hover:bg-dark-700 hover:text-gray-200">
                          <Pencil size={16} />
                        </button>
                        <button type="button" onClick={() => setDelId(e.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-950/50 hover:text-red-300">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-dark-700 rounded-2xl border border-dark-700 overflow-hidden">
              {imMonat.map(e => (
                <li key={e.id} className="p-4 space-y-2 bg-dark-800/40">
                  <div className="flex justify-between gap-2 items-start">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-100 break-words">{e.lieferant}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{e.rechnungsnummer}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-100 tabular-nums shrink-0">{fmtEur(e.betragBrutto)}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400">
                    <div>
                      <dt className="text-gray-600">Fällig</dt>
                      <dd className="text-gray-300">{e.faelligAm ? format(parseISO(e.faelligAm.slice(0, 10)), 'dd.MM.yyyy') : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">PDF</dt>
                      <dd>
                        {e.pdfUrl ? (
                          <a href={e.pdfUrl} target="_blank" rel="noreferrer" className="text-primary-400">
                            Öffnen
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => openEdit(e)} className="flex-1 rounded-lg border border-dark-600 py-2 text-sm">
                      Bearbeiten
                    </button>
                    <button type="button" onClick={() => setDelId(e.id)} className="flex-1 rounded-lg border border-red-900/50 text-red-300 py-2 text-sm">
                      Löschen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <FibuFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        userId={user.uid}
        onSaved={() => {}}
      />

      <ConfirmDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        title="Eingangsrechnung löschen?"
        message="Der Eintrag wird entfernt. Gespeicherte PDFs werden mitgelöscht."
        onConfirm={() => {
          if (delId) void deleteEingangsrechnung(delId);
        }}
      />
    </div>
  );
}
