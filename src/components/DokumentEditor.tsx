import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Dokument, Dokumentposition, DokumentTyp, Artikel } from '../types';
import { berechneGesamtsummen, fmtEur } from '../utils/berechnungen';
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

const cellInput = "bg-dark-900 border border-dark-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500";

function PositionRow({
  pos,
  idx,
  artikel,
  onChange,
  onDelete,
}: {
  pos: Dokumentposition;
  idx: number;
  artikel: Artikel[];
  onChange: (pos: Dokumentposition) => void;
  onDelete: () => void;
}) {
  const [showArtikelDropdown, setShowArtikelDropdown] = useState(false);

  const handleArtikelSelect = (a: Artikel) => {
    onChange({
      ...pos,
      artikelId: a.id,
      bezeichnung: a.bezeichnung,
      beschreibung: a.beschreibung,
      einheit: a.einheit,
      einzelpreis: a.preis,
      mwstSatz: a.mwstSatz,
    });
    setShowArtikelDropdown(false);
  };

  const netto = pos.menge * pos.einzelpreis * (1 - pos.rabatt / 100);

  return (
    <tr className="border-b border-dark-700">
      <td className="py-2 px-2 text-xs text-gray-500 text-center">{idx + 1}</td>
      <td className="py-2 px-2">
        <div className="relative">
          <div className="flex gap-1">
            <input
              value={pos.bezeichnung}
              onChange={e => onChange({ ...pos, bezeichnung: e.target.value })}
              placeholder="Bezeichnung"
              className={`flex-1 ${cellInput}`}
            />
            <button
              type="button"
              onClick={() => setShowArtikelDropdown(v => !v)}
              className="bg-dark-900 border border-dark-700 rounded px-1.5 py-1.5 text-gray-500 hover:text-primary-400 hover:border-primary-600 transition-colors"
              title="Aus Artikelstamm wählen"
            >
              <ChevronDown size={12} />
            </button>
          </div>
          {showArtikelDropdown && artikel.length > 0 && (
            <div className="absolute z-20 top-full left-0 mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-2xl w-72 max-h-48 overflow-y-auto">
              {artikel.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleArtikelSelect(a)}
                  className="w-full text-left px-3 py-2 hover:bg-dark-700 text-xs"
                >
                  <p className="font-medium text-gray-200">{a.bezeichnung}</p>
                  <p className="text-gray-500">{fmtEur(a.preis)} · {a.einheit}</p>
                </button>
              ))}
            </div>
          )}
          <input
            value={pos.beschreibung}
            onChange={e => onChange({ ...pos, beschreibung: e.target.value })}
            placeholder="Beschreibung (optional)"
            className={`mt-1 w-full ${cellInput} text-gray-400`}
          />
        </div>
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={pos.menge}
          onChange={e => onChange({ ...pos, menge: parseFloat(e.target.value) || 0 })}
          className={`w-16 ${cellInput} text-right`}
        />
      </td>
      <td className="py-2 px-2">
        <input
          value={pos.einheit}
          onChange={e => onChange({ ...pos, einheit: e.target.value })}
          className={`w-16 ${cellInput}`}
        />
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={pos.einzelpreis}
          onChange={e => onChange({ ...pos, einzelpreis: parseFloat(e.target.value) || 0 })}
          className={`w-24 ${cellInput} text-right`}
        />
      </td>
      <td className="py-2 px-2">
        <select
          value={pos.mwstSatz}
          onChange={e => onChange({ ...pos, mwstSatz: parseInt(e.target.value) })}
          className={`w-16 ${cellInput}`}
        >
          <option value={19}>19%</option>
          <option value={7}>7%</option>
          <option value={0}>0%</option>
        </select>
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={pos.rabatt}
          onChange={e => onChange({ ...pos, rabatt: parseFloat(e.target.value) || 0 })}
          className={`w-14 ${cellInput} text-right`}
        />
      </td>
      <td className="py-2 px-2 text-xs font-semibold text-right text-gray-200 whitespace-nowrap">
        {fmtEur(netto)}
      </td>
      <td className="py-2 px-2">
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

export default function DokumentEditor({ typ, initial, onSave, onCancel }: Props) {
  const { data } = useApp();
  const typLabel = typ === 'angebot' ? 'Angebot' : 'Rechnung';
  const today = format(new Date(), 'yyyy-MM-dd');

  const inputCls = "w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500";

  const { register, handleSubmit } = useForm<DokumentForm>({
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

  const addPosition = () => {
    setPositionen(prev => [
      ...prev,
      {
        id: uuidv4(),
        artikelId: '',
        bezeichnung: '',
        beschreibung: '',
        menge: 1,
        einheit: 'Stück',
        einzelpreis: 0,
        mwstSatz: 19,
        rabatt: 0,
      },
    ]);
  };

  const updatePosition = (id: string, pos: Dokumentposition) => {
    setPositionen(prev => prev.map(p => p.id === id ? pos : p));
  };

  const deletePosition = (id: string) => {
    setPositionen(prev => prev.filter(p => p.id !== id));
  };

  const { netto, mwstBetrag, brutto } = berechneGesamtsummen(positionen);

  const onSubmit = (formData: DokumentForm) => {
    const payload = { ...formData, typ, positionen };
    if (initial) {
      onSave({ ...initial, ...payload } as Dokument);
    } else {
      onSave(payload as Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'>);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Kopfdaten */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Kunde *</label>
          <select
            {...register('kundeId', { required: true })}
            className={inputCls}
          >
            <option value="">– Kunde wählen –</option>
            {data.kunden.map(k => (
              <option key={k.id} value={k.id}>{k.firma || k.ansprechpartner} ({k.kundennummer})</option>
            ))}
          </select>
        </div>
        <div>
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
        <div className="border border-dark-700 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-dark-900/60 border-b border-dark-700">
              <tr>
                <th className="py-2 px-2 text-gray-500 text-center w-8">#</th>
                <th className="py-2 px-2 text-gray-500 text-left">Bezeichnung</th>
                <th className="py-2 px-2 text-gray-500 text-right w-16">Menge</th>
                <th className="py-2 px-2 text-gray-500 text-left w-16">Einheit</th>
                <th className="py-2 px-2 text-gray-500 text-right w-24">Einzelpreis</th>
                <th className="py-2 px-2 text-gray-500 text-right w-16">MwSt.</th>
                <th className="py-2 px-2 text-gray-500 text-right w-16">Rabatt</th>
                <th className="py-2 px-2 text-gray-500 text-right w-24">Gesamt</th>
                <th className="py-2 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="bg-dark-800 divide-y divide-dark-700">
              {positionen.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-gray-600 text-xs">
                    Noch keine Positionen. Klicke auf "Position hinzufügen".
                  </td>
                </tr>
              )}
              {positionen.map((pos, idx) => (
                <PositionRow
                  key={pos.id}
                  pos={pos}
                  idx={idx}
                  artikel={data.artikel}
                  onChange={updated => updatePosition(pos.id, updated)}
                  onDelete={() => deletePosition(pos.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Summen */}
        <div className="flex justify-end mt-3">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Netto:</span>
              <span>{fmtEur(netto)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>MwSt.:</span>
              <span>{fmtEur(mwstBetrag)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-100 border-t border-dark-700 pt-1">
              <span>Gesamt (brutto):</span>
              <span className="text-primary-400">{fmtEur(brutto)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notizen */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Notizen / Hinweise</label>
        <textarea
          {...register('notizen')}
          rows={3}
          className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
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
