import { useMemo, useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, Download, Wallet, FileText, Loader2, Sparkles } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { storage } from '../firebase/config';
import { Eingangsrechnung } from '../types';
import { fmtEur } from '../utils/berechnungen';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const inputCls =
  'w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500';

function monthKey(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'yyyy-MM');
  } catch {
    return 'unbekannt';
  }
}

function formatMonthLabel(key: string): string {
  if (key === 'unbekannt') return 'Ohne Datum';
  try {
    return format(parseISO(`${key}-01`), 'MMMM yyyy', { locale: de });
  } catch {
    return key;
  }
}

function csvEscape(s: string): string {
  const t = String(s).replace(/"/g, '""');
  return `"${t}"`;
}

function downloadMonthCsv(rows: Eingangsrechnung[], fileSlug: string) {
  const header = ['Lieferant', 'Rechnungsnummer', 'Betrag Brutto (EUR)', 'Fällig am', 'Notizen', 'Erfasst am', 'PDF-URL'];
  const lines = [
    header.join(';'),
    ...rows.map(r =>
      [
        csvEscape(r.lieferant),
        csvEscape(r.rechnungsnummer),
        String(r.betragBrutto).replace('.', ','),
        csvEscape(r.faelligAm),
        csvEscape(r.notizen),
        csvEscape(r.erstelltAm.slice(0, 10)),
        csvEscape(r.pdfUrl ?? ''),
      ].join(';'),
    ),
  ];
  const bom = '\ufeff';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eingangsrechnungen-${fileSlug}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type FormData = {
  lieferant: string;
  rechnungsnummer: string;
  betragBrutto: number;
  faelligAm: string;
  notizen: string;
};

const emptyForm: FormData = {
  lieferant: '',
  rechnungsnummer: '',
  betragBrutto: 0,
  faelligAm: format(new Date(), 'yyyy-MM-dd'),
  notizen: '',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const base64 = s.includes(',') ? s.split(',')[1]! : s;
      resolve(base64);
    };
    r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    r.readAsDataURL(file);
  });
}

export default function Fibu() {
  const { user } = useAuth();
  const { data, addEingangsrechnung, updateEingangsrechnung, deleteEingangsrechnung } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [edit, setEdit] = useState<Eingangsrechnung | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: emptyForm,
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (!modalOpen) return;
    setSaveError('');
    if (edit) {
      reset({
        lieferant: edit.lieferant,
        rechnungsnummer: edit.rechnungsnummer,
        betragBrutto: edit.betragBrutto,
        faelligAm: edit.faelligAm.slice(0, 10),
        notizen: edit.notizen,
      });
      setPdfFile(null);
      setDraftId(null);
      setExtractError('');
    } else {
      reset(emptyForm);
      setPdfFile(null);
      setDraftId(uuidv4());
      setExtractError('');
    }
  }, [modalOpen, edit, reset]);

  const byMonth = useMemo(() => {
    const rows = data.eingangsrechnungen ?? [];
    const map = new Map<string, Eingangsrechnung[]>();
    for (const r of rows) {
      const k = monthKey(r.faelligAm);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.faelligAm.localeCompare(b.faelligAm));
    }
    const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return keys.map(k => ({ key: k, label: formatMonthLabel(k), items: map.get(k)! }));
  }, [data.eingangsrechnungen]);

  const onPickPdf = async (file: File | null) => {
    setExtractError('');
    if (!file || file.type !== 'application/pdf') {
      if (file) setExtractError('Bitte eine PDF-Datei wählen.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setExtractError('PDF maximal 5 MB.');
      return;
    }
    setPdfFile(file);
    setDraftId(prev => prev ?? uuidv4());

    setAnalyzing(true);
    try {
      const pdfBase64 = await fileToBase64(file);
      const res = await fetch('/api/extract-eingangsrechnung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      });
      const json = (await res.json()) as {
        error?: string;
        lieferant?: string;
        rechnungsnummer?: string;
        betragBrutto?: number;
        faelligAm?: string;
        notizen?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Extraktion fehlgeschlagen');

      reset({
        lieferant: json.lieferant ?? '',
        rechnungsnummer: json.rechnungsnummer ?? '',
        betragBrutto: typeof json.betragBrutto === 'number' ? json.betragBrutto : 0,
        faelligAm:
          json.faelligAm && /^\d{4}-\d{2}-\d{2}$/.test(json.faelligAm)
            ? json.faelligAm
            : format(new Date(), 'yyyy-MM-dd'),
        notizen: json.notizen ?? '',
      });
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEdit(null);
    setPdfFile(null);
    setDraftId(null);
    setExtractError('');
    setSaveError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSave = async (form: FormData) => {
    if (!user) {
      setSaveError('Bitte melde dich an.');
      return;
    }

    const targetId = edit?.id ?? draftId;
    if (!targetId) {
      setSaveError('Interner Fehler: keine Eintrags-ID. Bitte Dialog schließen und erneut öffnen.');
      return;
    }

    setSaveError('');
    let pdfUrl: string | undefined = edit?.pdfUrl;
    let pdfStoragePath: string | undefined = edit?.pdfStoragePath;

    try {
      if (pdfFile) {
        const path = `fibu/${user.uid}/${targetId}/rechnung.pdf`;
        if (edit?.pdfStoragePath && edit.pdfStoragePath !== path) {
          try {
            await deleteObject(ref(storage, edit.pdfStoragePath));
          } catch {
            /* alt fehlt */
          }
        }
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, pdfFile, { contentType: 'application/pdf' });
        pdfUrl = await getDownloadURL(storageRef);
        pdfStoragePath = path;
      }

      if (edit) {
        await updateEingangsrechnung({
          ...edit,
          ...form,
          pdfUrl,
          pdfStoragePath,
        });
      } else {
        await addEingangsrechnung({
          ...form,
          id: targetId,
          pdfUrl,
          pdfStoragePath,
        });
      }

      closeModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string })?.code;
      setSaveError(
        code === 'storage/unauthorized'
          ? 'Speichern fehlgeschlagen: Keine Berechtigung für Firebase Storage. Bitte Storage-Regeln deployen (fibu/…) und neu anmelden.'
          : `Speichern fehlgeschlagen: ${msg}`,
      );
    }
  };

  const totalAll = (data.eingangsrechnungen ?? []).reduce((s, r) => s + r.betragBrutto, 0);

  return (
    <div>
      <PageHeader
        title="Fibu"
        subtitle="Eingehende Rechnungen — nach Fälligkeit pro Monat"
        actions={
          <button
            type="button"
            onClick={() => {
              setEdit(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> Erfassen
          </button>
        }
      />

      <div className="page-padding space-y-6">
        {(data.eingangsrechnungen ?? []).length === 0 ? (
          <div className="bg-dark-800 rounded-2xl border border-dark-700 py-16 flex flex-col items-center gap-3 text-gray-600">
            <Wallet size={40} strokeWidth={1.2} />
            <p className="text-sm text-center px-4">Noch keine eingehenden Rechnungen. Lege die erste über „Erfassen“ an.</p>
          </div>
        ) : (
          <>
            <div className="bg-dark-800 rounded-xl border border-dark-700 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-gray-400">Summe aller erfassten Beträge (brutto)</span>
              <span className="font-semibold text-gray-100 tabular-nums">{fmtEur(totalAll)}</span>
            </div>

            {byMonth.map(({ key, label, items }) => {
              const sum = items.reduce((s, r) => s + r.betragBrutto, 0);
              return (
                <section key={key} className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 sm:px-5 border-b border-dark-700 bg-dark-900/40">
                    <div>
                      <h2 className="text-base font-semibold text-gray-100 capitalize">{label}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {items.length} Eintrag{items.length === 1 ? '' : 'e'} · Summe {fmtEur(sum)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadMonthCsv(items, key)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-dark-600 text-gray-300 hover:bg-dark-700 hover:text-primary-300 transition-colors shrink-0"
                    >
                      <Download size={16} />
                      Monat als CSV
                    </button>
                  </div>

                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="bg-dark-900/50 text-left border-b border-dark-700">
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Lieferant</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Rechnungsnr.</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Brutto</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Fällig</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">PDF</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Notizen</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700">
                        {items.map(r => (
                          <tr key={r.id} className="hover:bg-dark-700/40">
                            <td className="px-4 py-3 text-gray-200 font-medium break-words max-w-[12rem]">{r.lieferant}</td>
                            <td className="px-4 py-3 text-gray-400 font-mono text-xs">{r.rechnungsnummer}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-100 tabular-nums">{fmtEur(r.betragBrutto)}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {format(parseISO(r.faelligAm), 'dd.MM.yyyy', { locale: de })}
                            </td>
                            <td className="px-4 py-3">
                              {r.pdfUrl ? (
                                <a
                                  href={r.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary-400 hover:underline"
                                >
                                  <FileText size={14} /> PDF
                                </a>
                              ) : (
                                <span className="text-gray-600 text-xs">–</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs max-w-[10rem] break-words">{r.notizen || '–'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEdit(r);
                                    setModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="lg:hidden divide-y divide-dark-700">
                    {items.map(r => (
                      <li key={r.id} className="p-4 space-y-2">
                        <div className="flex justify-between gap-2 items-start">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-100 break-words">{r.lieferant}</p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{r.rechnungsnummer}</p>
                          </div>
                          <p className="text-sm font-bold text-gray-100 tabular-nums shrink-0">{fmtEur(r.betragBrutto)}</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          Fällig {format(parseISO(r.faelligAm), 'dd.MM.yyyy', { locale: de })}
                        </p>
                        {r.pdfUrl && (
                          <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-400">
                            <FileText size={14} /> PDF anzeigen
                          </a>
                        )}
                        {r.notizen && <p className="text-xs text-gray-500">{r.notizen}</p>}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEdit(r);
                              setModalOpen(true);
                            }}
                            className="flex-1 py-2 text-xs rounded-lg border border-dark-600 text-gray-400 hover:bg-dark-700"
                          >
                            Bearbeiten
                          </button>
                          <button type="button" onClick={() => setDeleteId(r.id)} className="flex-1 py-2 text-xs rounded-lg border border-dark-600 text-gray-400 hover:bg-red-900/20 hover:text-red-400">
                            Löschen
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={edit ? 'Rechnung bearbeiten' : 'Eingehende Rechnung'} size="md">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="rounded-xl border border-dark-700 bg-dark-900/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Sparkles size={16} className="text-violet-400" />
              PDF-Rechnung (optional)
            </div>
            <p className="text-xs text-gray-500">
              PDF hochladen — KI liest Lieferant, Nummer, Betrag und Fälligkeit vor. Du kannst alles vor dem Speichern anpassen.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                void onPickPdf(f);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={analyzing}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-900/40 text-violet-200 text-sm border border-violet-800 hover:bg-violet-900/60 disabled:opacity-50"
              >
                {analyzing ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {analyzing ? 'Analysiere…' : 'PDF wählen & auslesen'}
              </button>
              {pdfFile && (
                <span className="text-xs text-gray-400 self-center truncate max-w-[200px]" title={pdfFile.name}>
                  {pdfFile.name}
                </span>
              )}
            </div>
            {extractError && <p className="text-xs text-red-400">{extractError}</p>}
          </div>

          {saveError && (
            <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300 break-words">
              {saveError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Lieferant / Gläubiger *</label>
            <input {...register('lieferant', { required: 'Lieferant ist erforderlich' })} className={inputCls} placeholder="z. B. Strom GmbH" />
            {errors.lieferant && <p className="text-xs text-red-400 mt-1">{errors.lieferant.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Rechnungsnummer *</label>
            <input {...register('rechnungsnummer', { required: 'Rechnungsnummer ist erforderlich' })} className={inputCls} />
            {errors.rechnungsnummer && <p className="text-xs text-red-400 mt-1">{errors.rechnungsnummer.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Betrag brutto (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('betragBrutto', {
                  required: 'Betrag ist erforderlich',
                  valueAsNumber: true,
                  validate: v => !Number.isNaN(v) && v >= 0 || 'Ungültiger Betrag',
                })}
                className={inputCls}
              />
              {errors.betragBrutto && <p className="text-xs text-red-400 mt-1">{errors.betragBrutto.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Fällig am *</label>
              <input type="date" {...register('faelligAm', { required: 'Datum ist erforderlich' })} className={inputCls} />
              {errors.faelligAm && <p className="text-xs text-red-400 mt-1">{errors.faelligAm.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Notizen</label>
            <textarea {...register('notizen')} rows={2} className={`${inputCls} resize-none`} placeholder="optional" />
          </div>

          {edit?.pdfUrl && !pdfFile && (
            <p className="text-xs text-gray-500">
              Gespeicherte PDF:{' '}
              <a href={edit.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                öffnen
              </a>
              . Neue PDF ersetzt die Datei beim Speichern.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-dark-700">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700 transition-colors">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={analyzing}
              className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteEingangsrechnung(deleteId!)}
        title="Eintrag löschen"
        message="Diese eingehende Rechnung inkl. gespeicherter PDF wirklich löschen?"
      />
    </div>
  );
}
