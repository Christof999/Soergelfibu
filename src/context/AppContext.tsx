import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AppData, Firma, Kunde, Artikel, Dokument } from '../types';
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
};

const initialData: AppData = {
  firma: defaultFirma,
  kunden: [],
  artikel: [],
  dokumente: [],
};

type Action =
  | { type: 'SET_DATA'; payload: AppData }
  | { type: 'UPDATE_FIRMA'; payload: Firma }
  | { type: 'ADD_KUNDE'; payload: Omit<Kunde, 'id' | 'erstelltAm' | 'kundennummer'> }
  | { type: 'UPDATE_KUNDE'; payload: Kunde }
  | { type: 'DELETE_KUNDE'; payload: string }
  | { type: 'ADD_ARTIKEL'; payload: Omit<Artikel, 'id' | 'artikelnummer'> }
  | { type: 'UPDATE_ARTIKEL'; payload: Artikel }
  | { type: 'DELETE_ARTIKEL'; payload: string }
  | { type: 'ADD_DOKUMENT'; payload: Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'> }
  | { type: 'UPDATE_DOKUMENT'; payload: Dokument }
  | { type: 'DELETE_DOKUMENT'; payload: string };

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

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'SET_DATA':
      return action.payload;

    case 'UPDATE_FIRMA':
      return { ...state, firma: action.payload };

    case 'ADD_KUNDE': {
      const kunde: Kunde = {
        ...action.payload,
        id: uuidv4(),
        kundennummer: nextKundennummer(state.kunden),
        erstelltAm: new Date().toISOString(),
      };
      return { ...state, kunden: [...state.kunden, kunde] };
    }

    case 'UPDATE_KUNDE':
      return {
        ...state,
        kunden: state.kunden.map(k => k.id === action.payload.id ? action.payload : k),
      };

    case 'DELETE_KUNDE':
      return { ...state, kunden: state.kunden.filter(k => k.id !== action.payload) };

    case 'ADD_ARTIKEL': {
      const artikel: Artikel = {
        ...action.payload,
        id: uuidv4(),
        artikelnummer: nextArtikelnummer(state.artikel),
      };
      return { ...state, artikel: [...state.artikel, artikel] };
    }

    case 'UPDATE_ARTIKEL':
      return {
        ...state,
        artikel: state.artikel.map(a => a.id === action.payload.id ? action.payload : a),
      };

    case 'DELETE_ARTIKEL':
      return { ...state, artikel: state.artikel.filter(a => a.id !== action.payload) };

    case 'ADD_DOKUMENT': {
      const { typ } = action.payload;
      const prefix = typ === 'angebot' ? state.firma.angebotPrefix : state.firma.rechnungPrefix;
      const nr = typ === 'angebot' ? state.firma.nextAngebotNr : state.firma.nextRechnungNr;
      const nummer = `${prefix}-${new Date().getFullYear()}-${String(nr).padStart(4, '0')}`;
      const now = new Date().toISOString();
      const dokument: Dokument = {
        ...action.payload,
        id: uuidv4(),
        nummer,
        erstelltAm: now,
        geaendertAm: now,
      };
      const firma = { ...state.firma };
      if (typ === 'angebot') firma.nextAngebotNr = nr + 1;
      else firma.nextRechnungNr = nr + 1;
      return { ...state, firma, dokumente: [...state.dokumente, dokument] };
    }

    case 'UPDATE_DOKUMENT':
      return {
        ...state,
        dokumente: state.dokumente.map(d =>
          d.id === action.payload.id
            ? { ...action.payload, geaendertAm: new Date().toISOString() }
            : d
        ),
      };

    case 'DELETE_DOKUMENT':
      return { ...state, dokumente: state.dokumente.filter(d => d.id !== action.payload) };

    default:
      return state;
  }
}

const AppContext = createContext<{
  data: AppData;
  dispatch: React.Dispatch<Action>;
} | null>(null);

const STORAGE_KEY = 'soergelfibu_data';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, dispatch] = useReducer(reducer, initialData, () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as AppData;
    } catch {}
    return initialData;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  return <AppContext.Provider value={{ data, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
