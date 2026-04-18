import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, Search, Package } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import { Artikel } from '../types';
import { fmtEur } from '../utils/berechnungen';

type FormData = Omit<Artikel, 'id' | 'artikelnummer'>;

const defaultValues: FormData = {
  bezeichnung: '',
  beschreibung: '',
  einheit: 'Stück',
  preis: 0,
  mwstSatz: 19,
  kategorie: '',
};

function ArtikelForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: FormData;
  onSave: (data: FormData) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: initial ?? defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Bezeichnung *</label>
        <input
          {...register('bezeichnung', { required: 'Pflichtfeld' })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {errors.bezeichnung && <p className="text-xs text-red-500 mt-1">{errors.bezeichnung.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
        <textarea
          {...register('beschreibung')}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Preis (netto) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('preis', { required: 'Pflichtfeld', valueAsNumber: true })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">MwSt-Satz (%)</label>
          <select
            {...register('mwstSatz', { valueAsNumber: true })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={19}>19%</option>
            <option value={7}>7%</option>
            <option value={0}>0%</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Einheit</label>
          <input
            {...register('einheit')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie</label>
        <input
          {...register('kategorie')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          Abbrechen
        </button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">
          Speichern
        </button>
      </div>
    </form>
  );
}

export default function ArtikelPage() {
  const { data, addArtikel, updateArtikel, deleteArtikel } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editArtikel, setEditArtikel] = useState<Artikel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = data.artikel.filter(a =>
    [a.bezeichnung, a.beschreibung, a.kategorie, a.artikelnummer].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const openCreate = () => { setEditArtikel(null); setModalOpen(true); };
  const openEdit = (a: Artikel) => { setEditArtikel(a); setModalOpen(true); };

  const handleSave = async (formData: FormData) => {
    if (editArtikel) {
      await updateArtikel({ ...editArtikel, ...formData });
    } else {
      await addArtikel(formData);
    }
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Artikel"
        subtitle={`${data.artikel.length} Artikel gesamt`}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> Neuer Artikel
          </button>
        }
      />

      <div className="p-8 space-y-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen nach Bezeichnung, Kategorie…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-16 flex flex-col items-center gap-3 text-gray-400">
            <Package size={36} strokeWidth={1.2} />
            <p className="text-sm">{search ? 'Keine Ergebnisse gefunden.' : 'Noch keine Artikel angelegt.'}</p>
            {!search && (
              <button onClick={openCreate} className="text-primary-600 text-sm font-medium hover:underline">
                Ersten Artikel anlegen
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-200">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Nr.</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Bezeichnung</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Kategorie</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Einheit</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Preis (netto)</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">MwSt.</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{a.artikelnummer}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{a.bezeichnung}</p>
                      {a.beschreibung && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{a.beschreibung}</p>}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{a.kategorie || '–'}</td>
                    <td className="px-5 py-3 text-gray-500">{a.einheit}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtEur(a.preis)}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{a.mwstSatz}%</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editArtikel ? 'Artikel bearbeiten' : 'Neuer Artikel'} size="md">
        <ArtikelForm initial={editArtikel ?? undefined} onSave={handleSave} onCancel={() => setModalOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteArtikel(deleteId!)}
        title="Artikel löschen"
        message="Soll dieser Artikel wirklich gelöscht werden?"
      />
    </div>
  );
}
