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
  /** Gesetzt bei Rechnungen, die aus einem Angebot erzeugt wurden */
  quelleAngebotId?: string;
}

export type ServiceVertragIntervall = 'monatlich' | 'quartalsweise' | 'jaehrlich';

export interface ServiceVertrag {
  id: string;
  kundeId: string;
  /** Kurztitel, z. B. „Hosting & Betreuung Website XY“ */
  titel: string;
  /** Nettobetrag pro Abrechnungsintervall (siehe intervall) */
  betragNetto: number;
  intervall: ServiceVertragIntervall;
  mwstSatz: number;
  beginnAm: string;
  endeAm: string;
  kuendigungsfristMonate: number;
  /** Freitext: Leistungen (Hosting, Updates, Support-Stunden …) */
  leistungen: string;
  /** Zahlungsweise, SLA-Kurztext, Sonstiges */
  bedingungen: string;
  status: 'entwurf' | 'aktiv' | 'gekuendigt' | 'beendet';
  erstelltAm: string;
  geaendertAm: string;
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
  /** Geschätzte Steuerlast auf Gewinn (%) — nur Dashboard-Hinweis */
  dashboardSteuerSchaetzungProzent: number;
  /** Keine Umsatzsteuer ausweisen (§ 19 UStG); Einzelpreise gelten als Netto/Endpreis */
  kleinunternehmerRegelung: boolean;
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

export interface OptimierungPunkt {
  titel: string;
  empfehlung: string;
}

export interface LeadAnalyse {
  /** KI liefert strukturierte Punkte; ältere Daten können reine Strings sein */
  optimierungen: (string | OptimierungPunkt)[];
  ansprechpartner: string;
  zusammenfassung: string;
  websiteGeladen: boolean;
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
  akquiseEmailZuletztVersendetAm?: string;
}

/** Eingangsrechnung (Buchhaltung / Fibu) */
export interface Eingangsrechnung {
  id: string;
  lieferant: string;
  rechnungsnummer: string;
  /** Bruttobetrag EUR */
  betragBrutto: number;
  /** Fälligkeitsdatum ISO yyyy-mm-dd */
  faelligAm: string;
  notizen: string;
  erstelltAm: string;
  pdfUrl?: string;
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
  serviceVertraege: ServiceVertrag[];
}

// ─── Zugriff / Freigaben ─────────────────────────────────────────────────────

/**
 * „inhaber“ sieht den kompletten Arbeitsbereich, „akquise“ ausschließlich das
 * Akquise-Tool. Die Rolle wird nicht nur in der Oberfläche, sondern auch in den
 * Firestore-Regeln durchgesetzt (siehe firestore.rules).
 */
export type Rolle = 'inhaber' | 'akquise';

/**
 * Ein vom Inhaber freigeschalteter Zugang. Dokument-ID ist die E-Mail-Adresse
 * in Kleinbuchstaben, damit die Regeln sie direkt gegen das Auth-Token prüfen
 * können — der Zugang lässt sich dadurch anlegen, bevor sich die Person zum
 * ersten Mal anmeldet.
 */
export interface Mitglied {
  email: string;
  name: string;
  rolle: 'akquise';
  erstelltAm: string;
}

/** Zeiger von einer E-Mail-Adresse auf den freigebenden Arbeitsbereich. */
export interface Mitgliedschaft {
  ownerUid: string;
  ownerName: string;
  rolle: 'akquise';
  erstelltAm: string;
}

/**
 * Der für Akquise-Mitglieder lesbare Teil der Daten. Bewusst getrennt von
 * `AppData` gespeichert: Firestore-Regeln greifen pro Dokument, deshalb dürfen
 * hier keine Umsätze, Rechnungen oder Kundendaten hinein.
 */
export interface AkquiseData {
  leads: Lead[];
  /** Terminlink für die Akquise-E-Mails; gespiegelt aus `Firma.terminUrl`. */
  terminUrl: string;
}
