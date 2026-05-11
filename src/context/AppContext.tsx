import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  doc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { AppData, Firma, Kunde, Artikel, Dokument, Projekt, ProjektZugang, ProjektKommunikation, KommunikationsAnhang, Lead } from '../types';
import { v4 as uuidv4 } from 'uuid';

const defaultFirma: Firma = {
  name: 'Meine Softwarefirma GmbH',
  inhaber: 'Max Mustermann',
  strasse: 'Musterstraße 1',
  plz: '12345',
  ort: 'Musterstadt',
  land: 'Deutschland',
  email: 'info@meine-firma.de',
  telefon: '+49 123 456789',
  website: 'www.meine-firma.de',
  ustId: 'DE123456789',
  steuernummer: '12/345/67890',
  iban: 'DE12 3456 7890 1234 5678 90',
  bic: 'MUSTDEBANK',
  bank: 'Musterbank',
  logo: '',
  angebotPrefix: 'ANG',
  rechnungPrefix: 'RE',
  nextAngebotNr: 1,
  nextRechnungNr: 1,
  terminUrl: 'https://cal.com/',
};

const emptyData: AppData = {
  firma: defaultFirma,
  kunden: [],
  artikel: [],
  dokumente: [],
  projekte: [],
  leads: [],
};

// ─── Firestore erlaubt keine undefined-Werte ──────────────────────────────────

function sanitize<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(sanitize) as unknown as T;
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        v === undefined ? '' : sanitize(v),
      ])
    ) as T;
  }
  return obj;
}

// ─── Hilfsfunktionen für Nummernvergabe ──────────────────────────────────────

function nextKundennummer(kunden: Kunde[]): string {
  const max = kunden.reduce((acc, k) => {
    const n = parseInt(k.kundennummer.replace(/\D/g, ''), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `KD${String(max + 1).padStart(4, '0')}`;
}

function nextArtikelnummer(artikel: Artikel[]): string {
  const max = artikel.reduce((acc, a) => {
    const n = parseInt(a.artikelnummer.replace(/\D/g, ''), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `ART${String(max + 1).padStart(4, '0')}`;
}

// ─── Context Typen ────────────────────────────────────────────────────────────

interface AppContextValue {
  data: AppData;
  syncing: boolean;
  updateFirma: (firma: Firma) => Promise<void>;
  addKunde: (k: Omit<Kunde, 'id' | 'erstelltAm' | 'kundennummer'>) => Promise<void>;
  updateKunde: (k: Kunde) => Promise<void>;
  deleteKunde: (id: string) => Promise<void>;
  addArtikel: (a: Omit<Artikel, 'id' | 'artikelnummer'>) => Promise<void>;
  updateArtikel: (a: Artikel) => Promise<void>;
  deleteArtikel: (id: string) => Promise<void>;
  addDokument: (d: Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'>) => Promise<void>;
  updateDokument: (d: Dokument) => Promise<void>;
  deleteDokument: (id: string) => Promise<void>;
  addProjekt: (p: Omit<Projekt, 'id' | 'erstelltAm' | 'geaendertAm'>) => Promise<Projekt>;
  updateProjekt: (p: Projekt) => Promise<void>;
  deleteProjekt: (id: string) => Promise<void>;
  addZugang: (projektId: string, z: Omit<ProjektZugang, 'id'>) => Promise<void>;
  updateZugang: (projektId: string, z: ProjektZugang) => Promise<void>;
  deleteZugang: (projektId: string, zugangId: string) => Promise<void>;
  addKommunikation: (projektId: string, k: Omit<ProjektKommunikation, 'id' | 'erstelltAm'>) => Promise<ProjektKommunikation>;
  updateKommunikation: (projektId: string, k: ProjektKommunikation) => Promise<void>;
  deleteKommunikation: (projektId: string, komId: string) => Promise<void>;
  addAnhang: (projektId: string, komId: string, anhang: KommunikationsAnhang) => Promise<void>;
  deleteAnhang: (projektId: string, komId: string, anhangId: string) => Promise<void>;
  upsertLead: (lead: Lead) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  exportData: () => AppData;
  importData: (data: AppData) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<AppData>(emptyData);
  const [syncing, setSyncing] = useState(false);

  const userDocRef = user ? doc(db, 'users', user.uid, 'data', 'main') : null;

  useEffect(() => {
    if (!userDocRef) { setData(emptyData); return; }
    setSyncing(true);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data() as AppData;
        setData({ ...emptyData, ...d, projekte: d.projekte ?? [], leads: d.leads ?? [] });
      } else {
        setDoc(userDocRef, sanitize(emptyData));
      }
      setSyncing(false);
    });
    return unsub;
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(async (updated: AppData) => {
    if (!userDocRef) return;
    setData(updated);
    await setDoc(userDocRef, sanitize(updated));
  }, [userDocRef]);

  // ── Firma ─────────────────────────────────────────────────────────────────
  const updateFirma = async (firma: Firma) => persist({ ...data, firma });

  // ── Kunden ────────────────────────────────────────────────────────────────
  const addKunde = async (k: Omit<Kunde, 'id' | 'erstelltAm' | 'kundennummer'>) => {
    const kunde: Kunde = { ...k, id: uuidv4(), kundennummer: nextKundennummer(data.kunden), erstelltAm: new Date().toISOString() };
    await persist({ ...data, kunden: [...data.kunden, kunde] });
  };
  const updateKunde = async (k: Kunde) => persist({ ...data, kunden: data.kunden.map(x => x.id === k.id ? k : x) });
  const deleteKunde = async (id: string) => persist({ ...data, kunden: data.kunden.filter(x => x.id !== id) });

  // ── Artikel ───────────────────────────────────────────────────────────────
  const addArtikel = async (a: Omit<Artikel, 'id' | 'artikelnummer'>) => {
    const artikel: Artikel = { ...a, id: uuidv4(), artikelnummer: nextArtikelnummer(data.artikel) };
    await persist({ ...data, artikel: [...data.artikel, artikel] });
  };
  const updateArtikel = async (a: Artikel) => persist({ ...data, artikel: data.artikel.map(x => x.id === a.id ? a : x) });
  const deleteArtikel = async (id: string) => persist({ ...data, artikel: data.artikel.filter(x => x.id !== id) });

  // ── Dokumente ─────────────────────────────────────────────────────────────
  const addDokument = async (d: Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'>) => {
    const { typ } = d;
    const prefix = typ === 'angebot' ? data.firma.angebotPrefix : data.firma.rechnungPrefix;
    const nr = typ === 'angebot' ? data.firma.nextAngebotNr : data.firma.nextRechnungNr;
    const nummer = `${prefix}-${new Date().getFullYear()}-${String(nr).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const dokument: Dokument = { ...d, id: uuidv4(), nummer, erstelltAm: now, geaendertAm: now };
    const firma = { ...data.firma };
    if (typ === 'angebot') firma.nextAngebotNr = nr + 1;
    else firma.nextRechnungNr = nr + 1;
    await persist({ ...data, firma, dokumente: [...data.dokumente, dokument] });
  };
  const updateDokument = async (d: Dokument) =>
    persist({ ...data, dokumente: data.dokumente.map(x => x.id === d.id ? { ...d, geaendertAm: new Date().toISOString() } : x) });
  const deleteDokument = async (id: string) => persist({ ...data, dokumente: data.dokumente.filter(x => x.id !== id) });

  // ── Projekte ──────────────────────────────────────────────────────────────
  const addProjekt = async (p: Omit<Projekt, 'id' | 'erstelltAm' | 'geaendertAm'>): Promise<Projekt> => {
    const now = new Date().toISOString();
    const projekt: Projekt = { ...p, id: uuidv4(), erstelltAm: now, geaendertAm: now };
    await persist({ ...data, projekte: [...(data.projekte ?? []), projekt] });
    return projekt;
  };
  const updateProjekt = async (p: Projekt) =>
    persist({ ...data, projekte: data.projekte.map(x => x.id === p.id ? { ...p, geaendertAm: new Date().toISOString() } : x) });
  const deleteProjekt = async (id: string) =>
    persist({ ...data, projekte: data.projekte.filter(x => x.id !== id) });

  // ── Projektzugänge ────────────────────────────────────────────────────────
  const withProject = (id: string, fn: (p: Projekt) => Projekt) =>
    persist({ ...data, projekte: data.projekte.map(x => x.id === id ? fn(x) : x) });

  const addZugang = async (projektId: string, z: Omit<ProjektZugang, 'id'>) =>
    withProject(projektId, p => ({ ...p, zugaenge: [...p.zugaenge, { ...z, id: uuidv4() }], geaendertAm: new Date().toISOString() }));
  const updateZugang = async (projektId: string, z: ProjektZugang) =>
    withProject(projektId, p => ({ ...p, zugaenge: p.zugaenge.map(x => x.id === z.id ? z : x), geaendertAm: new Date().toISOString() }));
  const deleteZugang = async (projektId: string, zugangId: string) =>
    withProject(projektId, p => ({ ...p, zugaenge: p.zugaenge.filter(x => x.id !== zugangId), geaendertAm: new Date().toISOString() }));

  // ── Projektkommunikation ──────────────────────────────────────────────────
  const addKommunikation = async (projektId: string, k: Omit<ProjektKommunikation, 'id' | 'erstelltAm'>): Promise<ProjektKommunikation> => {
    const newKom: ProjektKommunikation = { ...k, id: uuidv4(), erstelltAm: new Date().toISOString(), anhaenge: k.anhaenge ?? [] };
    await withProject(projektId, p => ({ ...p, kommunikation: [...p.kommunikation, newKom], geaendertAm: new Date().toISOString() }));
    return newKom;
  };
  const updateKommunikation = async (projektId: string, k: ProjektKommunikation) =>
    withProject(projektId, p => ({ ...p, kommunikation: p.kommunikation.map(x => x.id === k.id ? k : x), geaendertAm: new Date().toISOString() }));
  const deleteKommunikation = async (projektId: string, komId: string) =>
    withProject(projektId, p => ({ ...p, kommunikation: p.kommunikation.filter(x => x.id !== komId), geaendertAm: new Date().toISOString() }));
  const addAnhang = async (projektId: string, komId: string, anhang: KommunikationsAnhang) =>
    withProject(projektId, p => ({
      ...p,
      kommunikation: p.kommunikation.map(k => k.id === komId ? { ...k, anhaenge: [...(k.anhaenge ?? []), anhang] } : k),
      geaendertAm: new Date().toISOString(),
    }));
  const deleteAnhang = async (projektId: string, komId: string, anhangId: string) =>
    withProject(projektId, p => ({
      ...p,
      kommunikation: p.kommunikation.map(k => k.id === komId ? { ...k, anhaenge: (k.anhaenge ?? []).filter(a => a.id !== anhangId) } : k),
      geaendertAm: new Date().toISOString(),
    }));

  // ── Leads (gesternde Akquise-Einträge) ───────────────────────────────────
  const upsertLead = async (lead: Lead) =>
    persist({ ...data, leads: [...(data.leads ?? []).filter(l => l.id !== lead.id), lead] });
  const deleteLead = async (id: string) =>
    persist({ ...data, leads: (data.leads ?? []).filter(l => l.id !== id) });

  // ── Import / Export ───────────────────────────────────────────────────────
  const exportData = () => data;
  const importData = async (imported: AppData) => persist(imported);

  return (
    <AppContext.Provider value={{
      data, syncing,
      updateFirma,
      addKunde, updateKunde, deleteKunde,
      addArtikel, updateArtikel, deleteArtikel,
      addDokument, updateDokument, deleteDokument,
      addProjekt, updateProjekt, deleteProjekt,
      addZugang, updateZugang, deleteZugang,
      addKommunikation, updateKommunikation, deleteKommunikation,
      addAnhang, deleteAnhang,
      upsertLead, deleteLead,
      exportData, importData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with provider
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
