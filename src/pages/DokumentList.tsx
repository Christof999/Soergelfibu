import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Download, Search, FileText, Receipt, Copy, FolderPlus, ArrowRightCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import DokumentEditor from '../components/DokumentEditor';
import { useApp } from '../context/AppContext';
import { Dokument, DokumentTyp } from '../types';
import { berechneGesamtsummen, fmtEur } from '../utils/berechnungen';
import { generatePDF } from '../utils/pdf';
import { buildRechnungAusAngebot } from '../utils/rechnungAusAngebot';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  typ: DokumentTyp;
}

export default function DokumentList({ typ }: Props) {
  const { data, addDokument, updateDokument, deleteDokument, addProjekt } = useApp();
  const ku = !!data.firma.kleinunternehmerRegelung;
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Dokument | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const typLabel = typ === 'angebot' ? 'Angebot' : 'Rechnung';
  const Icon = typ === 'angebot' ? FileText : Receipt;

  const docs = data.dokumente.filter(d => d.typ === typ);
  const filtered = docs.filter(d => {
    const kunde = data.kunden.find(k => k.id === d.kundeId);
    return [d.nummer, d.betreff, kunde?.firma, kunde?.ansprechpartner].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const openCreate = () => { setEditDoc(null); setModalOpen(true); };
  const openEdit = (d: Dokument) => { setEditDoc(d); setModalOpen(true); };

  const handleSave = async (payload: Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'> | Dokument) => {
    const wasAngebot = editDoc?.typ === 'angebot';
    const prevStatus = editDoc?.status;
    if ('id' in payload && payload.id) {
      await updateDokument(payload as Dokument);
      if (
        wasAngebot &&
        (payload as Dokument).status === 'akzeptiert' &&
        prevStatus !== 'akzeptiert'
      ) {
        alert('Status „Akzeptiert“ gespeichert. Es wurde automatisch eine Rechnung erstellt — unter Rechnungen.');
      }
    } else {
      await addDokument(payload as Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'>);
    }
    setModalOpen(false);
  };

  const handlePDF = (doc: Dokument) => {
    const kunde = data.kunden.find(k => k.id === doc.kundeId);
    if (!kunde) return alert('Kunde nicht gefunden.');
    generatePDF(doc, data.firma, kunde);
  };

  const handleProjektErstellen = async (doc: Dokument) => {
    const proj = await addProjekt({
      name: doc.betreff || doc.nummer,
      beschreibung: '',
      kundeId: doc.kundeId,
      angebotId: doc.id,
      status: 'aktiv',
      tags: [],
      zugaenge: [],
      kommunikation: [],
    });
    navigate(`/projekte/${proj.id}`);
  };

  const findRechnungAusAngebot = (angebotId: string) =>
    data.dokumente.find(d => d.typ === 'rechnung' && d.quelleAngebotId === angebotId);

  const handleRechnungAusAngebot = async (angebot: Dokument) => {
    if (angebot.typ !== 'angebot') return;
    if (findRechnungAusAngebot(angebot.id)) {
      alert('Zu diesem Angebot existiert bereits eine Rechnung.');
      return;
    }
    await addDokument(buildRechnungAusAngebot(angebot));
    navigate('/rechnungen');
  };

  const handleDuplicate = async (doc: Dokument) => {
    await addDokument({
      typ: doc.typ,
      kundeId: doc.kundeId,
      datum: new Date().toISOString().slice(0, 10),
      gueltigBis: doc.gueltigBis,
      faelligAm: doc.faelligAm,
      betreff: `Kopie von ${doc.betreff || doc.nummer}`,
      notizen: doc.notizen,
      zahlungsziel: doc.zahlungsziel,
      skonto: doc.skonto,
      positionen: doc.positionen,
      status: 'entwurf',
    });
  };

  const aktionen = (doc: Dokument) => {
    const hatRechnung = typ === 'angebot' && !!findRechnungAusAngebot(doc.id);
    return (
      <>
        <button onClick={() => handlePDF(doc)} title="PDF" className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors">
          <Download size={14} />
        </button>
        <button onClick={() => handleDuplicate(doc)} title="Duplizieren" className="p-1.5 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-900/30 transition-colors">
          <Copy size={14} />
        </button>
        {typ === 'angebot' && (
          <>
            <button
              type="button"
              onClick={() => void handleRechnungAusAngebot(doc)}
              title={hatRechnung ? 'Rechnung existiert bereits' : 'Rechnung aus Angebot'}
              disabled={hatRechnung}
              className={`p-1.5 rounded-lg transition-colors ${
                hatRechnung
                  ? 'text-gray-700 cursor-not-allowed'
                  : 'text-gray-500 hover:text-amber-400 hover:bg-amber-900/30'
              }`}
            >
              <ArrowRightCircle size={14} />
            </button>
            <button
              type="button"
              onClick={() => void handleProjektErstellen(doc)}
              title="Projekt erstellen"
              className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-900/30 transition-colors"
            >
              <FolderPlus size={14} />
            </button>
          </>
        )}
        <button type="button" onClick={() => openEdit(doc)} title="Bearbeiten" className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors">
          <Pencil size={14} />
        </button>
        <button type="button" onClick={() => setDeleteId(doc.id)} title="Löschen" className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors">
          <Trash2 size={14} />
        </button>
      </>
    );
  };

  return (
    <div>
      <PageHeader
        title={`${typLabel}e`}
        subtitle={`${docs.length} ${typLabel}e gesamt`}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> Neues {typLabel}
          </button>
        }
      />

      <div className="p-4 sm:p-8 space-y-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Suchen nach Nummer, Betreff, Kunde…`}
            className="w-full pl-9 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-dark-800 rounded-2xl border border-dark-700 py-16 flex flex-col items-center gap-3 text-gray-600">
            <Icon size={36} strokeWidth={1.2} />
            <p className="text-sm">{search ? 'Keine Ergebnisse gefunden.' : `Noch keine ${typLabel}e vorhanden.`}</p>
            {!search && (
              <button onClick={openCreate} className="text-primary-400 text-sm font-medium hover:underline">
                Erstes {typLabel} erstellen
              </button>
            )}
          </div>
        ) : (
          <>
          <div className="hidden md:block bg-dark-800 rounded-2xl border border-dark-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-900/60 text-left border-b border-dark-700">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Nummer</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Kunde</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Betreff</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Datum</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Betrag</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filtered.map(doc => {
                  const kunde = data.kunden.find(k => k.id === doc.kundeId);
                  const { brutto } = berechneGesamtsummen(doc.positionen, ku);
                  return (
                    <tr key={doc.id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-400 font-medium">{doc.nummer}</td>
                      <td className="px-5 py-3 text-gray-300">{kunde?.firma || '–'}</td>
                      <td className="px-5 py-3 text-gray-400 max-w-xs truncate">{doc.betreff || '–'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {format(new Date(doc.datum), 'dd.MM.yyyy', { locale: de })}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-200">{fmtEur(brutto)}</td>
                      <td className="px-5 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">{aktionen(doc)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden bg-dark-800 rounded-2xl border border-dark-700 divide-y divide-dark-700 overflow-hidden">
            {filtered.map(doc => {
              const kunde = data.kunden.find(k => k.id === doc.kundeId);
              const { brutto } = berechneGesamtsummen(doc.positionen, ku);
              return (
                <li key={doc.id} className="p-4 space-y-2">
                  <button type="button" onClick={() => openEdit(doc)} className="w-full text-left space-y-1">
                    <div className="flex justify-between gap-2 items-start">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-100 break-words">{kunde?.firma || '–'}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          {doc.nummer} · {format(new Date(doc.datum), 'dd.MM.yyyy', { locale: de })}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-100 tabular-nums shrink-0">{fmtEur(brutto)}</p>
                    </div>
                    {doc.betreff && <p className="text-sm text-gray-400 break-words">{doc.betreff}</p>}
                  </button>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={doc.status} />
                    <div className="flex items-center gap-1">{aktionen(doc)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editDoc ? `${typLabel} bearbeiten` : `Neues ${typLabel}`} size="xl">
        <DokumentEditor typ={typ} initial={editDoc ?? undefined} onSave={handleSave} onCancel={() => setModalOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteDokument(deleteId!)}
        title={`${typLabel} löschen`}
        message={`Soll dieses ${typLabel} wirklich gelöscht werden?`}
      />
    </div>
  );
}
