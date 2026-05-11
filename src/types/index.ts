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
  terminUrl: string;
  /**
   * Geschätzte Gesamt-Steuerlast auf den Gewinn (Umsatz − Ausgaben), in %.
   * Nur für die Dashboard-Anzeige — keine Steuerberatung.
   */
  dashboardSteuerSchaetzungProzent: number;
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

/** Ein KI-Punkt: kurze Überschrift + formulierung als direkte Kunden-Empfehlung */
export interface OptimierungPunkt {
  titel: string;
  empfehlung: string;
}

export interface LeadAnalyse {
  /** Neu: Objekte mit titel + empfehlung; Altbestand: ein String pro Punkt */
  optimierungen: (string | OptimierungPunkt)[];
  ansprechpartner: string;
  zusammenfassung: string;
  websiteGeladen: boolean;
  /** true = URL war angegeben und Inhalt wurde geladen; false = URL da, aber nicht ladbar */
  websiteErreichbar?: boolean;
  /**
   * Wenn die Website nicht automatisch geladen werden konnte: ein Fließtext für die Ansprache
   * (ohne nummerierte Punkte), Fokus Leistungen — WebApps, Media, Druck. Leer bei normaler Analyse.
   */
  akquiseOhneWebsiteText?: string;
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
  /** ISO-Zeitpunkt, wenn die Akquise-E-Mail zuletzt erfolgreich versendet (oder manuell) markiert wurde */
  akquiseEmailZuletztVersendetAm?: string;
}

/** Eingehende Rechnung (Zahlungsverpflichtung) für Fibu / Steuer */
export interface Eingangsrechnung {
  id: string;
  lieferant: string;
  rechnungsnummer: string;
  /** Bruttobetrag in EUR */
  betragBrutto: number;
  /** Fälligkeitsdatum (ISO yyyy-mm-dd), Gruppierung nach Monat */
  faelligAm: string;
  notizen: string;
  erstelltAm: string;
  /** Öffentliche Download-URL der Original-PDF in Firebase Storage */
  pdfUrl?: string;
  /** Pfad in Storage (z. B. fibu/{uid}/{id}.pdf) — zum Löschen */
  pdfStoragePath?: string;
}

export interface AppData {
  firma: Firma;
  kunden: Kunde[];
  artikel: Artikel[];
  dokumente: Dokument[];
  projekte: Projekt[];
  leads: Lead[];
  eingangsrechnungen: Eingangsrechnung[];
}
