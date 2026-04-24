import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Download, Search, FileText, Receipt, Copy, FolderPlus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import DokumentEditor from '../components/DokumentEditor';
import { useApp } from '../context/AppContext';
import { Dokument, DokumentTyp } from '../types';
import { berechneGesamtsummen, fmtEur } from '../utils/berechnungen';
import { generatePDF } from '../utils/pdf';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  typ: DokumentTyp;
}

export default function DokumentList({ typ }: Props) {
  const { data, addDokument, updateDokument, deleteDokument, addProjekt } = useApp();
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
    if ('id' in payload && payload.id) {
      await updateDokument(payload as Dokument);
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

  return (
    <div>
      <PageHeader
        title={`${typLabel}e`}
        subtitle={`${docs.length} ${typLabel}e gesamt`}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 w-full sm:w-auto bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> Neues {typLabel}
          </button>
        }
      />

      <div className="page-padding space-y-4">
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
          <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
            {/* Mobil: Karten */}
            <ul className="md:hidden divide-y divide-dark-700">
              {filtered.map(doc => {
                const kunde = data.kunden.find(k => k.id === doc.kundeId);
                const { brutto } = berechneGesamtsummen(doc.positionen);
                return (
                  <li key={doc.id} className="p-4 space-y-3">
                    <div className="flex justify-between gap-3 items-start min-w-0">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-gray-400 font-medium break-all">{doc.nummer}</p>
                        <p className="text-sm font-medium text-gray-200 mt-1 break-words">{kunde?.firma || '–'}</p>
                        {doc.betreff && <p className="text-xs text-gray-500 mt-1 break-words">{doc.betreff}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-100 tabular-nums">{fmtEur(brutto)}</p>
                        <p className="text-xs text-gray-500 mt-0.5 whitespace-nowrap">
                          {format(new Date(doc.datum), 'dd.MM.yyyy', { locale: de })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={doc.status} />
                      <div className="flex flex-wrap items-center gap-1 justify-end">
                        <button type="button" onClick={() => handlePDF(doc)} title="PDF" className="p-2 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors">
                          <Download size={16} />
                        </button>
                        <button type="button" onClick={() => handleDuplicate(doc)} title="Duplizieren" className="p-2 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-900/30 transition-colors">
                          <Copy size={16} />
                        </button>
                        {typ === 'angebot' && (
                          <button type="button" onClick={() => handleProjektErstellen(doc)} title="Projekt erstellen" className="p-2 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-900/30 transition-colors">
                            <FolderPlus size={16} />
                          </button>
                        )}
                        <button type="button" onClick={() => openEdit(doc)} className="p-2 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors">
                          <Pencil size={16} />
                        </button>
                        <button type="button" onClick={() => setDeleteId(doc.id)} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {/* Desktop: Tabelle */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
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
                    const { brutto } = berechneGesamtsummen(doc.positionen);
                    return (
                      <tr key={doc.id} className="hover:bg-dark-700/50 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-gray-400 font-medium whitespace-nowrap">{doc.nummer}</td>
                        <td className="px-5 py-3 text-gray-300 max-w-[140px] truncate">{kunde?.firma || '–'}</td>
                        <td className="px-5 py-3 text-gray-400 max-w-xs truncate">{doc.betreff || '–'}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {format(new Date(doc.datum), 'dd.MM.yyyy', { locale: de })}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-200 tabular-nums">{fmtEur(brutto)}</td>
                        <td className="px-5 py-3"><StatusBadge status={doc.status} /></td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <button type="button" onClick={() => handlePDF(doc)} title="PDF" className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors">
                              <Download size={14} />
                            </button>
                            <button type="button" onClick={() => handleDuplicate(doc)} title="Duplizieren" className="p-1.5 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-900/30 transition-colors">
                              <Copy size={14} />
                            </button>
                            {typ === 'angebot' && (
                              <button type="button" onClick={() => handleProjektErstellen(doc)} title="Projekt erstellen" className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-900/30 transition-colors">
                                <FolderPlus size={14} />
                              </button>
                            )}
                            <button type="button" onClick={() => openEdit(doc)} className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-900/30 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button type="button" onClick={() => setDeleteId(doc.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
