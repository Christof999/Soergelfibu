import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, Search, User } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import { Kunde } from '../types';

type FormData = Omit<Kunde, 'id' | 'erstelltAm' | 'kundennummer'>;

const defaultValues: FormData = {
  firma: '',
  ansprechpartner: '',
  email: '',
  telefon: '',
  strasse: '',
  plz: '',
  ort: '',
  land: 'Deutschland',
  ustId: '',
  notizen: '',
};

function KundeForm({
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

  const field = (label: string, name: keyof FormData, opts?: object) => (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input
        {...register(name, opts)}
        className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
      {errors[name] && <p className="text-xs text-red-400 mt-1">{String(errors[name]?.message)}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Firma / Name *', 'firma', { required: 'Pflichtfeld' })}
        {field('Ansprechpartner', 'ansprechpartner')}
        {field('E-Mail', 'email')}
        {field('Telefon', 'telefon')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {field('Straße', 'strasse')}
        {field('PLZ', 'plz')}
        {field('Ort', 'ort')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Land', 'land')}
        {field('USt-IdNr.', 'ustId')}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Notizen</label>
        <textarea
          {...register('notizen')}
          rows={3}
          className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
          Abbrechen
        </button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">
          Speichern
        </button>
      </div>
    </form>
  );
}

export default function Kunden() {
  const { data, addKunde, updateKunde, deleteKunde } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editKunde, setEditKunde] = useState<Kunde | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = data.kunden.filter(k =>
    [k.firma, k.ansprechpartner, k.email, k.kundennummer].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const openCreate = () => { setEditKunde(null); setModalOpen(true); };
  const openEdit = (k: Kunde) => { setEditKunde(k); setModalOpen(true); };

  const handleSave = async (formData: FormData) => {
    if (editKunde) {
      await updateKunde({ ...editKunde, ...formData });
    } else {
      await addKunde(formData);
    }
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Kunden"
        subtitle={`${data.kunden.length} Kunden gesamt`}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> Neuer Kunde
          </button>
        }
      />

      <div className="page-padding space-y-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen nach Firma, Name, E-Mail…"
            className="w-full pl-9 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-dark-800 rounded-2xl border border-dark-700 py-16 flex flex-col items-center gap-3 text-gray-600">
            <User size={36} strokeWidth={1.2} />
            <p className="text-sm">{search ? 'Keine Ergebnisse gefunden.' : 'Noch keine Kunden angelegt.'}</p>
            {!search && (
              <button onClick={openCreate} className="text-primary-400 text-sm font-medium hover:underline">
                Ersten Kunden anlegen
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden lg:block bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-dark-900/60 text-left border-b border-dark-700">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Nr.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Firma</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Ansprechpartner</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">E-Mail</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Ort</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filtered.map(k => (
                    <tr key={k.id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{k.kundennummer}</td>
                      <td className="px-5 py-3 font-medium text-gray-200 max-w-[14rem] break-words">{k.firma}</td>
                      <td className="px-5 py-3 text-gray-400 max-w-[10rem] break-words">{k.ansprechpartner}</td>
                      <td className="px-5 py-3 text-gray-400 break-all">{k.email}</td>
                      <td className="px-5 py-3 text-gray-400">{k.plz} {k.ort}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(k)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(k.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="lg:hidden space-y-3">
              {filtered.map(k => (
                <li key={k.id} className="bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-gray-500">{k.kundennummer}</p>
                      <p className="text-sm font-semibold text-gray-100 mt-0.5 break-words">{k.firma}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => openEdit(k)} className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteId(k.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {k.ansprechpartner && <p className="text-xs text-gray-400">{k.ansprechpartner}</p>}
                  {k.email && <p className="text-xs text-gray-500 break-all">{k.email}</p>}
                  <p className="text-xs text-gray-600">{k.plz} {k.ort}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editKunde ? 'Kunde bearbeiten' : 'Neuer Kunde'} size="lg">
        <KundeForm initial={editKunde ?? undefined} onSave={handleSave} onCancel={() => setModalOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteKunde(deleteId!)}
        title="Kunde löschen"
        message="Soll dieser Kunde wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </div>
  );
}
