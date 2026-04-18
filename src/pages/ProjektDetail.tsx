import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft, Plus, Pencil, Trash2, Eye, EyeOff,
  Link2, MessageSquare, Mail, Phone, FileText, StickyNote,
  Globe, Lock,
} from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import { ProjektZugang, ProjektKommunikation, KommunikationsTyp, ProjektStatus } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// ─── Hilfskonstanten ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProjektStatus, string> = {
  aktiv: 'Aktiv', pausiert: 'Pausiert', abgeschlossen: 'Abgeschlossen', archiviert: 'Archiviert',
};
const STATUS_CLS: Record<ProjektStatus, string> = {
  aktiv: 'bg-emerald-900/50 text-emerald-300',
  pausiert: 'bg-amber-900/50 text-amber-300',
  abgeschlossen: 'bg-blue-900/50 text-blue-300',
  archiviert: 'bg-gray-700/50 text-gray-400',
};

const KOM_ICONS: Record<KommunikationsTyp, React.ReactNode> = {
  gespraech: <Phone size={14} />,
  email: <Mail size={14} />,
  meeting: <MessageSquare size={14} />,
  notiz: <StickyNote size={14} />,
};
const KOM_LABELS: Record<KommunikationsTyp, string> = {
  gespraech: 'Gespräch', email: 'E-Mail', meeting: 'Meeting', notiz: 'Notiz',
};
const KOM_CLS: Record<KommunikationsTyp, string> = {
  gespraech: 'bg-violet-900/50 text-violet-300',
  email: 'bg-blue-900/50 text-blue-300',
  meeting: 'bg-emerald-900/50 text-emerald-300',
  notiz: 'bg-gray-700/50 text-gray-400',
};

const inputCls = "w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500";

// ─── Zugänge ─────────────────────────────────────────────────────────────────

function ZugangForm({ initial, onSave, onCancel }: {
  initial?: ProjektZugang;
  onSave: (z: Omit<ProjektZugang, 'id'>) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      bezeichnung: initial?.bezeichnung ?? '',
      url: initial?.url ?? '',
      benutzername: initial?.benutzername ?? '',
      passwort: initial?.passwort ?? '',
      notizen: initial?.notizen ?? '',
    },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">Bezeichnung *</label>
          <input {...register('bezeichnung', { required: true })} className={inputCls} placeholder="z.B. Hosting, CMS, Figma…" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">URL / Link</label>
          <input {...register('url')} className={inputCls} placeholder="https://…" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Benutzername / E-Mail</label>
          <input {...register('benutzername')} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Passwort / Token</label>
          <input {...register('passwort')} className={inputCls} type="text" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">Notizen</label>
          <textarea {...register('notizen')} rows={2} className={`${inputCls} resize-none`} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700 transition-colors">Abbrechen</button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">Speichern</button>
      </div>
    </form>
  );
}

function ZugangCard({ z, onEdit, onDelete }: { z: ProjektZugang; onEdit: () => void; onDelete: () => void }) {
  const [showPw, setShowPw] = useState(false);
  return (
    <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-primary-400 shrink-0" />
          <span className="font-medium text-gray-200 text-sm">{z.bezeichnung}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 rounded text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors"><Pencil size={13} /></button>
          <button onClick={onDelete} className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
      {z.url && (
        <a href={z.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary-400 hover:underline truncate">
          <Link2 size={11} />{z.url}
        </a>
      )}
      {z.benutzername && (
        <div className="text-xs text-gray-400">
          <span className="text-gray-500">Nutzer: </span>{z.benutzername}
        </div>
      )}
      {z.passwort && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="text-gray-500">Passwort: </span>
          <span className="font-mono">{showPw ? z.passwort : '••••••••'}</span>
          <button onClick={() => setShowPw(v => !v)} className="text-gray-600 hover:text-gray-300 transition-colors">
            {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
      )}
      {z.notizen && <p className="text-xs text-gray-500 pt-1 border-t border-dark-700">{z.notizen}</p>}
    </div>
  );
}

// ─── Kommunikation ────────────────────────────────────────────────────────────

function KomForm({ initial, onSave, onCancel }: {
  initial?: ProjektKommunikation;
  onSave: (k: Omit<ProjektKommunikation, 'id' | 'erstelltAm'>) => void;
  onCancel: () => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { register, handleSubmit } = useForm({
    defaultValues: {
      typ: initial?.typ ?? 'notiz' as KommunikationsTyp,
      datum: initial?.datum?.slice(0, 10) ?? today,
      betreff: initial?.betreff ?? '',
      inhalt: initial?.inhalt ?? '',
    },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Typ</label>
          <select {...register('typ')} className={inputCls}>
            <option value="notiz">Notiz</option>
            <option value="gespraech">Gespräch</option>
            <option value="email">E-Mail</option>
            <option value="meeting">Meeting</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Datum</label>
          <input type="date" {...register('datum')} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">Betreff</label>
          <input {...register('betreff')} className={inputCls} placeholder="Kurze Zusammenfassung" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">Inhalt</label>
          <textarea {...register('inhalt')} rows={5} className={`${inputCls} resize-none`} placeholder="Details, Ergebnisse, nächste Schritte…" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700 transition-colors">Abbrechen</button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">Speichern</button>
      </div>
    </form>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

type Tab = 'uebersicht' | 'zugaenge' | 'kommunikation';

export default function ProjektDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, updateProjekt, addZugang, updateZugang, deleteZugang, addKommunikation, updateKommunikation, deleteKommunikation } = useApp();

  const [tab, setTab] = useState<Tab>('uebersicht');
  const [zugangModal, setZugangModal] = useState(false);
  const [editZugang, setEditZugang] = useState<ProjektZugang | null>(null);
  const [deleteZugangId, setDeleteZugangId] = useState<string | null>(null);
  const [komModal, setKomModal] = useState(false);
  const [editKom, setEditKom] = useState<ProjektKommunikation | null>(null);
  const [deleteKomId, setDeleteKomId] = useState<string | null>(null);

  const projekt = data.projekte?.find(p => p.id === id);
  if (!projekt) {
    return (
      <div className="p-8 text-center text-gray-500">
        Projekt nicht gefunden.{' '}
        <button onClick={() => navigate('/projekte')} className="text-primary-400 hover:underline">Zurück zur Liste</button>
      </div>
    );
  }

  const kunde = data.kunden.find(k => k.id === projekt.kundeId);
  const angebot = data.dokumente.find(d => d.id === projekt.angebotId);

  // Status wechseln
  const setStatus = (status: ProjektStatus) => updateProjekt({ ...projekt, status });

  // ── Zugänge
  const saveZugang = async (z: Omit<ProjektZugang, 'id'>) => {
    if (editZugang) await updateZugang(projekt.id, { ...editZugang, ...z });
    else await addZugang(projekt.id, z);
    setZugangModal(false);
  };

  // ── Kommunikation
  const saveKom = async (k: Omit<ProjektKommunikation, 'id' | 'erstelltAm'>) => {
    if (editKom) await updateKommunikation(projekt.id, { ...editKom, ...k });
    else await addKommunikation(projekt.id, k);
    setKomModal(false);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'zugaenge', label: 'Zugänge & Links', count: projekt.zugaenge.length },
    { id: 'kommunikation', label: 'Kommunikation', count: projekt.kommunikation.length },
  ];

  return (
    <div>
      {/* Kopf */}
      <div className="bg-dark-800 border-b border-dark-700 px-8 py-5">
        <button onClick={() => navigate('/projekte')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3 transition-colors">
          <ArrowLeft size={14} /> Alle Projekte
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-100">{projekt.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[projekt.status]}`}>
                {STATUS_LABELS[projekt.status]}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {kunde && <span>{kunde.firma || kunde.ansprechpartner}</span>}
              {angebot && <><span>·</span><span className="text-gray-600">{angebot.nummer}</span></>}
              <span>·</span>
              <span>Erstellt {format(new Date(projekt.erstelltAm), 'dd.MM.yyyy', { locale: de })}</span>
            </div>
          </div>
          {/* Status-Schnellwechsel */}
          <select
            value={projekt.status}
            onChange={e => setStatus(e.target.value as ProjektStatus)}
            className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {(Object.keys(STATUS_LABELS) as ProjektStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-primary-600/20 text-primary-300' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="bg-dark-700 text-gray-400 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Inhalt */}
      <div className="p-8">

        {/* ── Tab: Übersicht ── */}
        {tab === 'uebersicht' && (
          <div className="space-y-6 max-w-2xl">
            {projekt.beschreibung && (
              <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Beschreibung</h3>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{projekt.beschreibung}</p>
              </div>
            )}
            {projekt.tags.length > 0 && (
              <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {projekt.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-dark-700 text-gray-300 text-sm rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {angebot && (
              <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Verknüpftes Angebot</h3>
                <div className="flex items-center gap-3">
                  <FileText size={15} className="text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">{angebot.nummer}</p>
                    {angebot.betreff && <p className="text-xs text-gray-500">{angebot.betreff}</p>}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Zugänge</p>
                <p className="font-semibold text-gray-200">{projekt.zugaenge.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Kommunikation</p>
                <p className="font-semibold text-gray-200">{projekt.kommunikation.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Erstellt am</p>
                <p className="text-gray-300">{format(new Date(projekt.erstelltAm), 'dd.MM.yyyy', { locale: de })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Zuletzt geändert</p>
                <p className="text-gray-300">{format(new Date(projekt.geaendertAm), 'dd.MM.yyyy', { locale: de })}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Zugänge & Links ── */}
        {tab === 'zugaenge' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setEditZugang(null); setZugangModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={15} /> Zugang hinzufügen
              </button>
            </div>
            {projekt.zugaenge.length === 0 ? (
              <div className="bg-dark-800 border border-dashed border-dark-700 rounded-2xl py-16 flex flex-col items-center gap-3 text-gray-600">
                <Lock size={36} strokeWidth={1.2} />
                <p className="text-sm">Noch keine Zugänge hinterlegt.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projekt.zugaenge.map(z => (
                  <ZugangCard
                    key={z.id}
                    z={z}
                    onEdit={() => { setEditZugang(z); setZugangModal(true); }}
                    onDelete={() => setDeleteZugangId(z.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Kommunikation ── */}
        {tab === 'kommunikation' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setEditKom(null); setKomModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={15} /> Eintrag hinzufügen
              </button>
            </div>
            {projekt.kommunikation.length === 0 ? (
              <div className="bg-dark-800 border border-dashed border-dark-700 rounded-2xl py-16 flex flex-col items-center gap-3 text-gray-600">
                <MessageSquare size={36} strokeWidth={1.2} />
                <p className="text-sm">Noch keine Einträge vorhanden.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projekt.kommunikation
                  .slice()
                  .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
                  .map(k => (
                    <div key={k.id} className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${KOM_CLS[k.typ]}`}>
                            {KOM_ICONS[k.typ]}{KOM_LABELS[k.typ]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">{k.betreff || '(Kein Betreff)'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {format(new Date(k.datum), 'dd.MM.yyyy', { locale: de })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditKom(k); setKomModal(true); }} className="p-1.5 rounded text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteKomId(k.id)} className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {k.inhalt && (
                        <p className="text-sm text-gray-400 mt-3 pt-3 border-t border-dark-700 whitespace-pre-wrap">{k.inhalt}</p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={zugangModal} onClose={() => setZugangModal(false)} title={editZugang ? 'Zugang bearbeiten' : 'Zugang hinzufügen'} size="md">
        <ZugangForm initial={editZugang ?? undefined} onSave={saveZugang} onCancel={() => setZugangModal(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteZugangId}
        onClose={() => setDeleteZugangId(null)}
        onConfirm={() => deleteZugang(projekt.id, deleteZugangId!)}
        title="Zugang löschen"
        message="Soll dieser Zugang wirklich gelöscht werden?"
      />

      <Modal open={komModal} onClose={() => setKomModal(false)} title={editKom ? 'Eintrag bearbeiten' : 'Neuer Eintrag'} size="md">
        <KomForm initial={editKom ?? undefined} onSave={saveKom} onCancel={() => setKomModal(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteKomId}
        onClose={() => setDeleteKomId(null)}
        onConfirm={() => deleteKommunikation(projekt.id, deleteKomId!)}
        title="Eintrag löschen"
        message="Soll dieser Kommunikationseintrag wirklich gelöscht werden?"
      />
    </div>
  );
}
