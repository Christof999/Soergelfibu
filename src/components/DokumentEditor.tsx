import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Dokument, Dokumentposition, DokumentTyp, Artikel } from '../types';
import { berechneGesamtsummen, fmtEur } from '../utils/berechnungen';
import { KLEINUNTERNEHMER_HINWEIS_USTG } from '../utils/steuern';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';

type DokumentForm = {
  kundeId: string;
  datum: string;
  gueltigBis: string;
  faelligAm: string;
  betreff: string;
  notizen: string;
  zahlungsziel: number;
  skonto: number;
  status: Dokument['status'];
};

interface Props {
  typ: DokumentTyp;
  initial?: Dokument;
  onSave: (data: Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'> | Dokument) => void;
  onCancel: () => void;
}

const inputCls = "w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500";
const cellInput = "bg-dark-900 border border-dark-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full";

function PositionRow({
  pos,
  idx,
  artikel,
  kleinunternehmer,
  onChange,
  onDelete,
}: {
  pos: Dokumentposition;
  idx: number;
  artikel: Artikel[];
  kleinunternehmer: boolean;
  onChange: (pos: Dokumentposition) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Dropdown schließen bei Klick außerhalb
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (a: Artikel) => {
    onChange({
      ...pos,
      artikelId: a.id,
      bezeichnung: a.bezeichnung,
      beschreibung: a.beschreibung ?? '',
      einheit: a.einheit,
      einzelpreis: a.preis,
      mwstSatz: a.mwstSatz,
    });
    setOpen(false);
  };

  const netto = pos.menge * pos.einzelpreis * (1 - pos.rabatt / 100);

  return (
    <div className="border border-dark-700 rounded-xl p-3 space-y-2">
      {/* Zeile 1: Nummer + Bezeichnung + Artikel-Picker + Löschen */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-500 w-5 pt-2 text-center shrink-0">{idx + 1}</span>
        <div className="flex-1 relative" ref={dropRef}>
          <div className="flex gap-1.5">
            <input
              value={pos.bezeichnung}
              onChange={e => onChange({ ...pos, bezeichnung: e.target.value })}
              placeholder="Bezeichnung *"
              className={`flex-1 ${cellInput}`}
            />
            {artikel.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="shrink-0 bg-dark-900 border border-dark-700 rounded px-2 py-1.5 text-gray-400 hover:text-primary-400 hover:border-primary-600 transition-colors"
                title="Aus Artikelstamm wählen"
              >
                <ChevronDown size={13} />
              </button>
            )}
          </div>
          {/* Dropdown – fixed Breite, kein Overflow-Clipping */}
          {open && (
            <div className="absolute z-50 top-full left-0 mt-1 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl w-80 max-h-52 overflow-y-auto scrollbar-thin">
              {artikel.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); pick(a); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-dark-700 transition-colors border-b border-dark-700/50 last:border-0"
                >
                  <p className="text-xs font-medium text-gray-200">{a.bezeichnung}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {kleinunternehmer
                      ? `${fmtEur(a.preis)} Endbetrag · ${a.einheit}`
                      : `${fmtEur(a.preis)} netto · ${a.einheit} · ${a.mwstSatz}% MwSt.`}
                  </p>
                </button>
              ))}
            </div>
          )}
          <input
            value={pos.beschreibung}
            onChange={e => onChange({ ...pos, beschreibung: e.target.value })}
            placeholder="Beschreibung (optional)"
            className={`mt-1.5 ${cellInput} text-gray-400 text-xs`}
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors mt-0.5"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Zeile 2: Menge / Einheit / Einzelpreis / MwSt / Rabatt / Gesamt */}
      <div className="flex items-center gap-2 pl-7">
        <div className="flex flex-col gap-0.5 w-16">
          <span className="text-xs text-gray-500">Menge</span>
          <input
            type="number" min="0" step="0.01"
            value={pos.menge}
            onChange={e => onChange({ ...pos, menge: parseFloat(e.target.value) || 0 })}
            className={`${cellInput} text-right`}
          />
        </div>
        <div className="flex flex-col gap-0.5 w-16">
          <span className="text-xs text-gray-500">Einheit</span>
          <input
            value={pos.einheit}
            onChange={e => onChange({ ...pos, einheit: e.target.value })}
            className={cellInput}
          />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-xs text-gray-500">
            {kleinunternehmer ? 'Einzelpreis (Endbetrag)' : 'Einzelpreis (€)'}
          </span>
          <input
            type="number" min="0" step="0.01"
            value={pos.einzelpreis}
            onChange={e => onChange({ ...pos, einzelpreis: parseFloat(e.target.value) || 0 })}
            className={`${cellInput} text-right`}
          />
        </div>
        <div className="flex flex-col gap-0.5 w-16">
          <span className="text-xs text-gray-500">MwSt.</span>
          {kleinunternehmer ? (
            <div className={`${cellInput} text-gray-500 text-center py-1.5`} title="Keine gesonderte Umsatzsteuerausweisung">
              –
            </div>
          ) : (
            <select
              value={pos.mwstSatz}
              onChange={e => onChange({ ...pos, mwstSatz: parseInt(e.target.value) })}
              className={cellInput}
            >
              <option value={19}>19%</option>
              <option value={7}>7%</option>
              <option value={0}>0%</option>
            </select>
          )}
        </div>
        <div className="flex flex-col gap-0.5 w-16">
          <span className="text-xs text-gray-500">Rabatt%</span>
          <input
            type="number" min="0" max="100" step="0.5"
            value={pos.rabatt}
            onChange={e => onChange({ ...pos, rabatt: parseFloat(e.target.value) || 0 })}
            className={`${cellInput} text-right`}
          />
        </div>
        <div className="flex flex-col gap-0.5 text-right shrink-0">
          <span className="text-xs text-gray-500">{kleinunternehmer ? 'Betrag' : 'Gesamt (netto)'}</span>
          <span className="text-xs font-semibold text-gray-200 py-1.5">{fmtEur(netto)}</span>
        </div>
      </div>
    </div>
  );
}

export default function DokumentEditor({ typ, initial, onSave, onCancel }: Props) {
  const { data } = useApp();
  const ku = !!data.firma.kleinunternehmerRegelung;
  const typLabel = typ === 'angebot' ? 'Angebot' : 'Rechnung';
  const today = format(new Date(), 'yyyy-MM-dd');

  const { register, handleSubmit, reset } = useForm<DokumentForm>({
    defaultValues: {
      kundeId: initial?.kundeId ?? '',
      datum: initial?.datum?.slice(0, 10) ?? today,
      gueltigBis: initial?.gueltigBis?.slice(0, 10) ?? '',
      faelligAm: initial?.faelligAm?.slice(0, 10) ?? '',
      betreff: initial?.betreff ?? '',
      notizen: initial?.notizen ?? '',
      zahlungsziel: initial?.zahlungsziel ?? 14,
      skonto: initial?.skonto ?? 0,
      status: initial?.status ?? 'entwurf',
    },
  });

  const [positionen, setPositionen] = useState<Dokumentposition[]>(
    initial?.positionen ?? []
  );

  useEffect(() => {
    const d = format(new Date(), 'yyyy-MM-dd');
    reset({
      kundeId: initial?.kundeId ?? '',
      datum: initial?.datum?.slice(0, 10) ?? d,
      gueltigBis: initial?.gueltigBis?.slice(0, 10) ?? '',
      faelligAm: initial?.faelligAm?.slice(0, 10) ?? '',
      betreff: initial?.betreff ?? '',
      notizen: initial?.notizen ?? '',
      zahlungsziel: initial?.zahlungsziel ?? 14,
      skonto: initial?.skonto ?? 0,
      status: initial?.status ?? 'entwurf',
    });
    setPositionen(initial?.positionen ?? []);
    // Formular nur bei anderem Datensatz oder Typ zurücksetzen (kein Deep-Tracking von `initial`)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst nur initial?.id + typ
  }, [initial?.id, typ, reset]);

  const addPosition = () =>
    setPositionen(prev => [
      ...prev,
      { id: uuidv4(), artikelId: '', bezeichnung: '', beschreibung: '', menge: 1, einheit: 'Stück', einzelpreis: 0, mwstSatz: 19, rabatt: 0 },
    ]);

  const { netto, mwstBetrag, brutto } = berechneGesamtsummen(positionen, ku);

  const onSubmit = (formData: DokumentForm) => {
    const payload = { ...formData, typ, positionen };
    if (initial) {
      onSave({ ...initial, ...payload } as Dokument);
    } else {
      onSave(payload as Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'>);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Kopfdaten */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-400 mb-1">Kunde *</label>
          <select {...register('kundeId', { required: true })} className={inputCls}>
            <option value="">– Kunde wählen –</option>
            {data.kunden.map(k => (
              <option key={k.id} value={k.id}>{k.firma || k.ansprechpartner} ({k.kundennummer})</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-400 mb-1">Betreff</label>
          <input {...register('betreff')} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Datum</label>
          <input type="date" {...register('datum')} className={inputCls} />
        </div>
        {typ === 'angebot' ? (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Gültig bis</label>
            <input type="date" {...register('gueltigBis')} className={inputCls} />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Fällig am</label>
            <input type="date" {...register('faelligAm')} className={inputCls} />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Zahlungsziel (Tage)</label>
          <input type="number" {...register('zahlungsziel', { valueAsNumber: true })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Skonto (%)</label>
          <input type="number" step="0.5" min="0" max="20" {...register('skonto', { valueAsNumber: true })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
          <select {...register('status')} className={inputCls}>
            <option value="entwurf">Entwurf</option>
            <option value="gesendet">Gesendet</option>
            {typ === 'angebot' && <option value="akzeptiert">Akzeptiert</option>}
            {typ === 'angebot' && <option value="abgelehnt">Abgelehnt</option>}
            {typ === 'rechnung' && <option value="bezahlt">Bezahlt</option>}
            {typ === 'rechnung' && <option value="ueberfaellig">Überfällig</option>}
            <option value="storniert">Storniert</option>
          </select>
        </div>
      </div>

      {/* Positionen */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-300">Positionen</h3>
          <button
            type="button"
            onClick={addPosition}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-400 border border-primary-700 rounded-lg hover:bg-primary-900/30 transition-colors"
          >
            <Plus size={13} /> Position hinzufügen
          </button>
        </div>

        <div className="space-y-2">
          {positionen.length === 0 ? (
            <div className="border border-dashed border-dark-700 rounded-xl py-8 text-center text-gray-600 text-xs">
              Noch keine Positionen. Klicke auf "Position hinzufügen".
            </div>
          ) : (
            positionen.map((pos, idx) => (
              <PositionRow
                key={pos.id}
                pos={pos}
                idx={idx}
                artikel={data.artikel}
                kleinunternehmer={ku}
                onChange={updated => setPositionen(prev => prev.map(p => p.id === pos.id ? updated : p))}
                onDelete={() => setPositionen(prev => prev.filter(p => p.id !== pos.id))}
              />
            ))
          )}
        </div>

        {/* Summen */}
        {positionen.length > 0 && (
          <div className="flex justify-end mt-3">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>{ku ? 'Zwischensumme:' : 'Netto:'}</span>
                <span>{fmtEur(netto)}</span>
              </div>
              {!ku && (
                <div className="flex justify-between text-gray-400">
                  <span>MwSt.:</span>
                  <span>{fmtEur(mwstBetrag)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-100 border-t border-dark-700 pt-1">
                <span>{ku ? 'Gesamtbetrag:' : 'Gesamt (brutto):'}</span>
                <span className="text-primary-400">{fmtEur(brutto)}</span>
              </div>
              {ku && (
                <p className="text-[10px] text-gray-600 leading-snug pt-1">
                  {KLEINUNTERNEHMER_HINWEIS_USTG}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notizen */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Notizen / Hinweise</label>
        <textarea
          {...register('notizen')}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-dark-700">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
          Abbrechen
        </button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium">
          {typLabel} speichern
        </button>
      </div>
    </form>
  );
}
