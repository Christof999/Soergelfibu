import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, FolderKanban, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import { Projekt, ProjektStatus } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type FormData = {
  name: string;
  kundeId: string;
  angebotId: string;
  status: ProjektStatus;
  beschreibung: string;
  tags: string;
};

const STATUS_LABELS: Record<ProjektStatus, string> = {
  aktiv: 'Aktiv',
  pausiert: 'Pausiert',
  abgeschlossen: 'Abgeschlossen',
  archiviert: 'Archiviert',
};

const STATUS_CLS: Record<ProjektStatus, string> = {
  aktiv: 'bg-emerald-900/50 text-emerald-300',
  pausiert: 'bg-amber-900/50 text-amber-300',
  abgeschlossen: 'bg-blue-900/50 text-blue-300',
  archiviert: 'bg-gray-700/50 text-gray-400',
};

function ProjektForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<FormData>;
  onSave: (d: FormData) => void;
  onCancel: () => void;
}) {
  const { data } = useApp();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: initial?.name ?? '',
      kundeId: initial?.kundeId ?? '',
      angebotId: initial?.angebotId ?? '',
      status: initial?.status ?? 'aktiv',
      beschreibung: initial?.beschreibung ?? '',
      tags: initial?.tags ?? '',
    },
  });

  const inputCls = "w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">Projektname *</label>
          <input {...register('name', { required: 'Pflichtfeld' })} className={inputCls} placeholder="z.B. Website Relaunch – Muster GmbH" />
          {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Kunde</label>
          <select {...register('kundeId')} className={inputCls}>
            <option value="">– Kein Kunde –</option>
            {data.kunden.map(k => <option key={k.id} value={k.id}>{k.firma || k.ansprechpartner}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Verknüpftes Angebot</label>
          <select {...register('angebotId')} className={inputCls}>
            <option value="">– Kein Angebot –</option>
            {data.dokumente.filter(d => d.typ === 'angebot').map(d => (
              <option key={d.id} value={d.id}>{d.nummer}{d.betreff ? ` – ${d.betreff}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
          <select {...register('status')} className={inputCls}>
            {(Object.keys(STATUS_LABELS) as ProjektStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Tags (kommagetrennt)</label>
          <input {...register('tags')} className={inputCls} placeholder="z.B. WebApp, SEO, React" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">Beschreibung</label>
          <textarea {...register('beschreibung')} rows={4} className={`${inputCls} resize-none`} placeholder="Beschreibe das Projekt, Ziele, Technologien…" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">Abbrechen</button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">Speichern</button>
      </div>
    </form>
  );
}

export default function Projekte() {
  const { data, addProjekt, updateProjekt, deleteProjekt } = useApp();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editProjekt, setEditProjekt] = useState<Projekt | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const projekte = data.projekte ?? [];

  const handleSave = async (formData: FormData) => {
    const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (editProjekt) {
      await updateProjekt({ ...editProjekt, ...formData, tags });
    } else {
      const neu = await addProjekt({ ...formData, tags, zugaenge: [], kommunikation: [] });
      setModalOpen(false);
      navigate(`/projekte/${neu.id}`);
      return;
    }
    setModalOpen(false);
  };

  const openCreate = () => { setEditProjekt(null); setModalOpen(true); };
  const openEdit = (p: Projekt) => { setEditProjekt(p); setModalOpen(true); };

  return (
    <div>
      <PageHeader
        title="Projekte"
        subtitle={`${projekte.length} Projekte gesamt`}
        actions={
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
            <Plus size={16} /> Neues Projekt
          </button>
        }
      />

      <div className="p-8">
        {projekte.length === 0 ? (
          <div className="bg-dark-800 rounded-2xl border border-dark-700 py-20 flex flex-col items-center gap-4 text-gray-600">
            <FolderKanban size={44} strokeWidth={1.2} />
            <p className="text-sm">Noch keine Projekte angelegt.</p>
            <button onClick={openCreate} className="text-primary-400 text-sm font-medium hover:underline">Erstes Projekt anlegen</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {projekte
              .slice()
              .sort((a, b) => new Date(b.erstelltAm).getTime() - new Date(a.erstelltAm).getTime())
              .map(p => {
                const kunde = data.kunden.find(k => k.id === p.kundeId);
                const angebot = data.dokumente.find(d => d.id === p.angebotId);
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/projekte/${p.id}`)}
                    className="bg-dark-800 border border-dark-700 rounded-2xl p-5 hover:border-primary-700/50 hover:bg-dark-800/80 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-semibold text-gray-100 group-hover:text-primary-300 transition-colors truncate">{p.name}</h3>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[p.status]}`}>
                            {STATUS_LABELS[p.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                          {kunde && <span>{kunde.firma || kunde.ansprechpartner}</span>}
                          {angebot && <><span>·</span><span>{angebot.nummer}</span></>}
                          <span>·</span>
                          <span>{format(new Date(p.erstelltAm), 'dd.MM.yyyy', { locale: de })}</span>
                        </div>
                        {p.beschreibung && (
                          <p className="text-sm text-gray-400 line-clamp-2">{p.beschreibung}</p>
                        )}
                        {p.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {p.tags.map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-dark-700 text-gray-400 text-xs rounded-full">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(p); }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteId(p.id); }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-dark-700 text-xs text-gray-600">
                      <span>{p.zugaenge.length} Zugäng{p.zugaenge.length === 1 ? '' : 'e'}</span>
                      <span>·</span>
                      <span>{p.kommunikation.length} Einträg{p.kommunikation.length === 1 ? '' : 'e'}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editProjekt ? 'Projekt bearbeiten' : 'Neues Projekt'} size="lg">
        <ProjektForm
          initial={editProjekt ? { ...editProjekt, tags: editProjekt.tags.join(', ') } : undefined}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteProjekt(deleteId!)}
        title="Projekt löschen"
        message="Soll dieses Projekt wirklich gelöscht werden? Alle Zugänge und Kommunikationseinträge werden ebenfalls gelöscht."
      />
    </div>
  );
}
