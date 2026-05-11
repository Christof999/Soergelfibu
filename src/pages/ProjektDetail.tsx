import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft, Plus, Pencil, Trash2, Eye, EyeOff,
  Link2, MessageSquare, Mail, Phone, FileText, StickyNote,
  Globe, Lock, ChevronDown, ChevronUp, Paperclip, X,
  FileIcon, Loader2,
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApp } from '../context/AppContext';
import {
  ProjektZugang, ProjektKommunikation, KommunikationsTyp,
  ProjektStatus, KommunikationsAnhang,
} from '../types';
import { berechneZeile, berechneGesamtsummen, fmtEur } from '../utils/berechnungen';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';

// ─── Konstanten ───────────────────────────────────────────────────────────────

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
  gespraech: <Phone size={14} />, email: <Mail size={14} />,
  meeting: <MessageSquare size={14} />, notiz: <StickyNote size={14} />,
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

// ─── Angebot Positionen (aufklappbar) ────────────────────────────────────────

function AngebotPositionen({ angebot }: { angebot: NonNullable<ReturnType<typeof useApp>['data']['dokumente'][0]> }) {
  const [open, setOpen] = useState(false);
  const { netto, mwstBetrag, brutto } = berechneGesamtsummen(angebot.positionen);

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-dark-700/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText size={15} className="text-amber-400 shrink-0" />
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-200">{angebot.nummer}</p>
            {angebot.betreff && <p className="text-xs text-gray-500">{angebot.betreff}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-gray-200">{fmtEur(brutto)}</span>
          {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-dark-700">
          {angebot.positionen.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">Keine Positionen vorhanden.</p>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-dark-900/60 text-xs font-semibold text-gray-500">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Bezeichnung</div>
                <div className="col-span-1 text-right">Menge</div>
                <div className="col-span-1">Einheit</div>
                <div className="col-span-2 text-right">Einzelpreis</div>
                <div className="col-span-1 text-right">MwSt.</div>
                <div className="col-span-2 text-right">Gesamt</div>
              </div>
              {angebot.positionen.map((pos, idx) => {
                const { netto: posNetto } = berechneZeile(pos);
                return (
                  <div key={pos.id} className="grid grid-cols-12 gap-2 px-5 py-3 border-t border-dark-700 text-sm hover:bg-dark-700/30 transition-colors">
                    <div className="col-span-1 text-gray-500 text-xs pt-0.5">{idx + 1}</div>
                    <div className="col-span-4">
                      <p className="text-gray-200 font-medium">{pos.bezeichnung}</p>
                      {pos.beschreibung && <p className="text-xs text-gray-500 mt-0.5">{pos.beschreibung}</p>}
                    </div>
                    <div className="col-span-1 text-right text-gray-300">{pos.menge.toLocaleString('de-DE')}</div>
                    <div className="col-span-1 text-gray-400 text-xs pt-0.5">{pos.einheit}</div>
                    <div className="col-span-2 text-right text-gray-300">{fmtEur(pos.einzelpreis)}</div>
                    <div className="col-span-1 text-right text-gray-400 text-xs pt-0.5">
                      {pos.mwstSatz}%{pos.rabatt > 0 && <span className="block text-amber-400">-{pos.rabatt}%</span>}
                    </div>
                    <div className="col-span-2 text-right font-semibold text-gray-200">{fmtEur(posNetto)}</div>
                  </div>
                );
              })}
              {/* Summen */}
              <div className="border-t border-dark-700 px-5 py-3 space-y-1">
                <div className="flex justify-end gap-8 text-xs text-gray-400">
                  <span>Netto: <span className="text-gray-300 font-medium">{fmtEur(netto)}</span></span>
                  <span>MwSt.: <span className="text-gray-300 font-medium">{fmtEur(mwstBetrag)}</span></span>
                </div>
                <div className="flex justify-end text-sm font-bold text-gray-100">
                  Gesamt: <span className="ml-4 text-primary-400">{fmtEur(brutto)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
          <input {...register('passwort')} className={inputCls} />
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
      {z.benutzername && <div className="text-xs text-gray-400"><span className="text-gray-500">Nutzer: </span>{z.benutzername}</div>}
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

// ─── Kommunikation mit Dateianhängen ─────────────────────────────────────────

function UploadZone({
  projektId, komId, onUploaded,
}: { projektId: string; komId: string; onUploaded: (a: KommunikationsAnhang) => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<{ name: string; progress: number; error?: string }[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || !user) return;
    Array.from(files).forEach(file => {
      const id = uuidv4();
      // Dateinamen bereinigen (Leerzeichen → Unterstrich, Sonderzeichen entfernen)
      const safeName = file.name.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
      const path = `projects/${user.uid}/${projektId}/${komId}/${id}_${safeName}`;
      const storageRef = ref(storage, path);

      setUploads(prev => [...prev, { name: file.name, progress: 0 }]);

      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      });

      task.on(
        'state_changed',
        snap => {
          const pct = snap.totalBytes > 0
            ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            : 0;
          setUploads(prev => prev.map(u => u.name === file.name ? { ...u, progress: pct } : u));
        },
        err => {
          console.error('Upload-Fehler:', err.code, err.message);
          setUploads(prev => prev.map(u =>
            u.name === file.name ? { ...u, error: `Fehler: ${err.code}` } : u
          ));
          setTimeout(() => setUploads(prev => prev.filter(u => u.name !== file.name)), 4000);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          onUploaded({
            id,
            name: file.name,
            url,
            contentType: file.type || 'application/octet-stream',
            groesse: file.size,
          });
          setUploads(prev => prev.filter(u => u.name !== file.name));
        },
      );
    });
  };

  const active = uploads.filter(u => !u.error);
  const errors = uploads.filter(u => u.error);

  return (
    <div className="space-y-1">
      <input
        ref={fileRef} type="file" multiple className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.eml,.msg,.zip"
        onChange={e => { handleFiles(e.target.files); if (fileRef.current) fileRef.current.value = ''; }}
      />
      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium border border-dashed rounded-lg cursor-pointer transition-all ${
          isDragOver
            ? 'border-primary-500 bg-primary-900/20 text-primary-300'
            : 'border-dark-600 text-gray-400 hover:border-primary-600 hover:text-primary-400'
        }`}
      >
        <Paperclip size={12} />
        {isDragOver ? 'Loslassen zum Hochladen' : 'Datei anhängen oder hierher ziehen (.eml, Bilder, PDF…)'}
      </div>
      {active.map(u => (
        <div key={u.name} className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={11} className="animate-spin shrink-0 text-primary-400" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between mb-0.5">
              <span className="truncate max-w-[160px]">{u.name}</span>
              <span className="shrink-0 ml-2 text-primary-400">{u.progress}%</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-1">
              <div className="bg-primary-500 h-1 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
            </div>
          </div>
        </div>
      ))}
      {errors.map(u => (
        <p key={u.name} className="text-xs text-red-400">{u.name}: {u.error}</p>
      ))}
    </div>
  );
}

function AnhangItem({ a, onDelete }: { a: KommunikationsAnhang; onDelete: () => void }) {
  const isImage = a.contentType.startsWith('image/');
  const sizeMb = (a.groesse / 1024 / 1024).toFixed(1);

  return (
    <div className="group relative">
      {isImage ? (
        <div className="relative w-24 h-20 rounded-lg overflow-hidden border border-dark-600 bg-dark-900">
          <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded bg-white/10 text-white hover:bg-white/20 transition-colors" title="Öffnen">
              <Eye size={12} />
            </a>
            <button onClick={onDelete} className="p-1 rounded bg-red-600/80 text-white hover:bg-red-600 transition-colors" title="Löschen">
              <X size={12} />
            </button>
          </div>
          <p className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-white text-xs truncate">{a.name}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg">
          <FileIcon size={14} className="text-primary-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:underline truncate block">{a.name}</a>
            <span className="text-xs text-gray-600">{sizeMb} MB</span>
          </div>
          <button onClick={onDelete} className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function KomForm({ initial, onSave, onCancel, projektId, komId }: {
  initial?: ProjektKommunikation;
  onSave: (k: Omit<ProjektKommunikation, 'id' | 'erstelltAm'>) => void;
  onCancel: () => void;
  projektId: string;
  komId: string;
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
  const [anhaenge, setAnhaenge] = useState<KommunikationsAnhang[]>(initial?.anhaenge ?? []);
  const { user } = useAuth();

  const handleDeleteAnhang = async (a: KommunikationsAnhang) => {
    if (user) {
      const path = `projects/${user.uid}/${projektId}/${komId}/${a.id}_${a.name}`;
      try { await deleteObject(ref(storage, path)); } catch { /* Datei evtl. schon weg */ }
    }
    setAnhaenge(prev => prev.filter(x => x.id !== a.id));
  };

  const submit = (formData: { typ: KommunikationsTyp; datum: string; betreff: string; inhalt: string }) => {
    onSave({ ...formData, anhaenge });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
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
          <textarea {...register('inhalt')} rows={4} className={`${inputCls} resize-none`} placeholder="Details, Ergebnisse, nächste Schritte…" />
        </div>
      </div>

      {/* Anhänge */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">Anhänge</label>
        {anhaenge.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {anhaenge.map(a => (
              <AnhangItem key={a.id} a={a} onDelete={() => handleDeleteAnhang(a)} />
            ))}
          </div>
        )}
        <UploadZone
          projektId={projektId}
          komId={komId}
          onUploaded={a => setAnhaenge(prev => [...prev, a])}
        />
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
  const { user } = useAuth();
  const { data, updateProjekt, addZugang, updateZugang, deleteZugang, addKommunikation, updateKommunikation, deleteKommunikation, addAnhang, deleteAnhang } = useApp();

  const [tab, setTab] = useState<Tab>('uebersicht');
  const [zugangModal, setZugangModal] = useState(false);
  const [editZugang, setEditZugang] = useState<ProjektZugang | null>(null);
  const [deleteZugangId, setDeleteZugangId] = useState<string | null>(null);
  const [komModal, setKomModal] = useState(false);
  const [editKom, setEditKom] = useState<ProjektKommunikation | null>(null);
  const [deleteKomId, setDeleteKomId] = useState<string | null>(null);
  // ID des gerade zu erstellenden/bearbeitenden Eintrags (für Upload-Pfad)
  const [activeKomId] = useState(() => uuidv4());

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

  const setStatus = (status: ProjektStatus) => updateProjekt({ ...projekt, status });

  const saveZugang = async (z: Omit<ProjektZugang, 'id'>) => {
    if (editZugang) await updateZugang(projekt.id, { ...editZugang, ...z });
    else await addZugang(projekt.id, z);
    setZugangModal(false);
  };

  const saveKom = async (k: Omit<ProjektKommunikation, 'id' | 'erstelltAm'>) => {
    if (editKom) {
      await updateKommunikation(projekt.id, { ...editKom, ...k });
    } else {
      await addKommunikation(projekt.id, { ...k, anhaenge: k.anhaenge ?? [] });
    }
    setKomModal(false);
    setEditKom(null);
  };

  const handleDeleteAnhangFromCard = async (komId: string, anhang: KommunikationsAnhang) => {
    if (user) {
      const path = `projects/${user.uid}/${projekt.id}/${komId}/${anhang.id}_${anhang.name}`;
      try { await deleteObject(ref(storage, path)); } catch { /* ok */ }
    }
    await deleteAnhang(projekt.id, komId, anhang.id);
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

      <div className="p-8">

        {/* ── Übersicht ── */}
        {tab === 'uebersicht' && (
          <div className="space-y-5 max-w-3xl">
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
                  {projekt.tags.map(tag => <span key={tag} className="px-3 py-1 bg-dark-700 text-gray-300 text-sm rounded-full">{tag}</span>)}
                </div>
              </div>
            )}
            {/* Angebot mit aufklappbaren Positionen */}
            {angebot && <AngebotPositionen angebot={angebot} />}
            <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-gray-500 mb-0.5">Zugänge</p><p className="font-semibold text-gray-200">{projekt.zugaenge.length}</p></div>
              <div><p className="text-xs text-gray-500 mb-0.5">Kommunikation</p><p className="font-semibold text-gray-200">{projekt.kommunikation.length}</p></div>
              <div><p className="text-xs text-gray-500 mb-0.5">Erstellt am</p><p className="text-gray-300">{format(new Date(projekt.erstelltAm), 'dd.MM.yyyy', { locale: de })}</p></div>
              <div><p className="text-xs text-gray-500 mb-0.5">Zuletzt geändert</p><p className="text-gray-300">{format(new Date(projekt.geaendertAm), 'dd.MM.yyyy', { locale: de })}</p></div>
            </div>
          </div>
        )}

        {/* ── Zugänge ── */}
        {tab === 'zugaenge' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => { setEditZugang(null); setZugangModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
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
                  <ZugangCard key={z.id} z={z}
                    onEdit={() => { setEditZugang(z); setZugangModal(true); }}
                    onDelete={() => setDeleteZugangId(z.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Kommunikation ── */}
        {tab === 'kommunikation' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => { setEditKom(null); setKomModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
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
                            <p className="text-xs text-gray-500 mt-0.5">{format(new Date(k.datum), 'dd.MM.yyyy', { locale: de })}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditKom(k); setKomModal(true); }} className="p-1.5 rounded text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteKomId(k.id)} className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {k.inhalt && <p className="text-sm text-gray-400 mt-3 pt-3 border-t border-dark-700 whitespace-pre-wrap">{k.inhalt}</p>}

                      {/* Anhänge direkt in der Karte */}
                      {(k.anhaenge ?? []).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-dark-700">
                          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5"><Paperclip size={11} />{k.anhaenge!.length} Anhang{k.anhaenge!.length !== 1 ? '¨e' : ''}</p>
                          <div className="flex flex-wrap gap-2">
                            {k.anhaenge!.map(a => (
                              <AnhangItem key={a.id} a={a} onDelete={() => handleDeleteAnhangFromCard(k.id, a)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Schnell-Upload direkt aus der Karte */}
                      <div className="mt-2">
                        <UploadZone
                          projektId={projekt.id}
                          komId={k.id}
                          onUploaded={a => addAnhang(projekt.id, k.id, a)}
                        />
                      </div>
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
      <ConfirmDialog open={!!deleteZugangId} onClose={() => setDeleteZugangId(null)} onConfirm={() => deleteZugang(projekt.id, deleteZugangId!)} title="Zugang löschen" message="Soll dieser Zugang wirklich gelöscht werden?" />

      <Modal open={komModal} onClose={() => { setKomModal(false); setEditKom(null); }} title={editKom ? 'Eintrag bearbeiten' : 'Neuer Eintrag'} size="md">
        <KomForm
          initial={editKom ?? undefined}
          onSave={saveKom}
          onCancel={() => { setKomModal(false); setEditKom(null); }}
          projektId={projekt.id}
          komId={editKom?.id ?? activeKomId}
        />
      </Modal>
      <ConfirmDialog open={!!deleteKomId} onClose={() => setDeleteKomId(null)} onConfirm={() => deleteKommunikation(projekt.id, deleteKomId!)} title="Eintrag löschen" message="Soll dieser Kommunikationseintrag wirklich gelöscht werden?" />
    </div>
  );
}
