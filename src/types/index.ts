export interface Kunde {
  id: string;
  firma: string;
  ansprechpartner: string;
  email: string;
  telefon: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  ustId: string;
  kundennummer: string;
  erstelltAm: string;
  notizen: string;
}

export interface Artikel {
  id: string;
  artikelnummer: string;
  bezeichnung: string;
  beschreibung: string;
  einheit: string;
  preis: number;
  mwstSatz: number;
  kategorie: string;
}

export interface Dokumentposition {
  id: string;
  artikelId: string;
  bezeichnung: string;
  beschreibung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  mwstSatz: number;
  rabatt: number;
}

export type DokumentStatus =
  | 'entwurf'
  | 'gesendet'
  | 'akzeptiert'
  | 'abgelehnt'
  | 'bezahlt'
  | 'storniert'
  | 'ueberfaellig';

export type DokumentTyp = 'angebot' | 'rechnung';

export interface Dokument {
  id: string;
  typ: DokumentTyp;
  nummer: string;
  kundeId: string;
  datum: string;
  gueltigBis?: string;
  faelligAm?: string;
  positionen: Dokumentposition[];
  status: DokumentStatus;
  notizen: string;
  zahlungsziel: number;
  skonto: number;
  erstelltAm: string;
  geaendertAm: string;
  betreff: string;
}

export interface Firma {
  name: string;
  inhaber: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  email: string;
  telefon: string;
  website: string;
  ustId: string;
  steuernummer: string;
  iban: string;
  bic: string;
  bank: string;
  logo: string;
  angebotPrefix: string;
  rechnungPrefix: string;
  nextAngebotNr: number;
  nextRechnungNr: number;
}

// ─── Projektmanagement ────────────────────────────────────────────────────────

export type ProjektStatus = 'aktiv' | 'pausiert' | 'abgeschlossen' | 'archiviert';

export type KommunikationsTyp = 'gespraech' | 'email' | 'notiz' | 'meeting';

export interface ProjektZugang {
  id: string;
  bezeichnung: string;
  url: string;
  benutzername: string;
  passwort: string;
  notizen: string;
}

export interface KommunikationsAnhang {
  id: string;
  name: string;
  url: string;
  contentType: string;
  groesse: number;
}

export interface ProjektKommunikation {
  id: string;
  typ: KommunikationsTyp;
  datum: string;
  betreff: string;
  inhalt: string;
  anhaenge: KommunikationsAnhang[];
  erstelltAm: string;
}

export interface Projekt {
  id: string;
  name: string;
  beschreibung: string;
  kundeId: string;
  angebotId: string;
  status: ProjektStatus;
  tags: string[];
  zugaenge: ProjektZugang[];
  kommunikation: ProjektKommunikation[];
  erstelltAm: string;
  geaendertAm: string;
}

// ─── Akquise-Tool ─────────────────────────────────────────────────────────────

export interface LeadAnalyse {
  optimierungen: string[];
  ansprechpartner: string;
  zusammenfassung: string;
  analysiertAm: string;
}

export interface Lead {
  id: string;
  name: string;
  adresse: string;
  telefon: string;
  email: string;
  website: string;
  branche: string;
  placeId: string;
  bewertung: number;
  bewertungsAnzahl: number;
  analyse: LeadAnalyse | null;
  stern: boolean;
  erstelltAm: string;
}

export interface AppData {
  firma: Firma;
  kunden: Kunde[];
  artikel: Artikel[];
  dokumente: Dokument[];
  projekte: Projekt[];
  leads: Lead[];
}
