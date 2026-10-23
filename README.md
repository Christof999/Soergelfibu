# SörgelFibu

Modernes Rechnungsprogramm für Softwarefirmen — gebaut mit React + Vite, deploybar auf Vercel.

## Features

- **Dashboard** — Umsatzübersicht, offene Rechnungen, zuletzt erstellte Dokumente
- **Kundenverwaltung** — Anlegen, bearbeiten, suchen; automatische Kundennummer
- **Artikelstamm** — Artikel/Dienstleistungen mit Preis, MwSt-Satz, Einheit und Kategorie
- **Angebote** — Erstellen, bearbeiten, als PDF exportieren, duplizieren; Status-Tracking
- **Rechnungen** — Wie Angebote, inkl. Zahlungsziel, Fälligkeitsdatum und Bankdaten im PDF
- **Einstellungen** — Firmenstammdaten, Nummerierungsprefix, JSON-Backup-Import/Export
- **PDF-Export** — Professionelle PDFs mit Positionstabelle, MwSt-Aufschlüsselung, Bankverbindung

## Technologie

- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3
- React Router v6
- React Hook Form
- jsPDF + jsPDF-AutoTable (PDF-Generierung)
- LocalStorage (Datenpersistenz im Browser)

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Die Firebase-Web-Konfiguration wird ausschliesslich ueber Umgebungsvariablen geladen.
Kopiere fuer lokale Entwicklung bei Bedarf `.env.example` nach `.env.local` oder ziehe
die in Vercel hinterlegten Werte mit `vercel env pull .env.local`.

## Deployment auf Vercel

1. Repository mit Vercel verbinden
2. Framework: **Vite**
3. Build-Befehl: `npm run build`
4. Output-Verzeichnis: `dist`
5. Firebase-Variablen im Vercel-Projekt unter **Settings -> Environment Variables** setzen
6. Die `vercel.json` sorgt für korrektes SPA-Routing

## Akquise-Zugang für externe Personen

Ein eingeschränkter Zugang gibt ausschließlich das Akquise-Tool frei. Angebote,
Rechnungen, Kunden, Projekte, Fibu und alle Umsatzzahlen bleiben gesperrt.

Aufbau in Firestore:

| Dokument | Inhalt | Wer darf zugreifen |
| --- | --- | --- |
| `users/{uid}/data/main` | Firma, Kunden, Angebote, Rechnungen, Projekte, Fibu | nur der Inhaber |
| `users/{uid}/data/akquise` | Leads + Terminlink | Inhaber **und** freigeschaltete Adressen |
| `users/{uid}/mitglieder/{email}` | vergebene Zugänge | Inhaber (schreibend), das Mitglied liest nur seinen Eintrag |
| `mitgliedschaften/{email}` | Zeiger auf den freigebenden Arbeitsbereich | das Mitglied selbst |

Zugang einrichten:

1. **Einstellungen → Akquise-Zugänge**: Google-Adresse der Person eintragen und
   freischalten.
2. Die Person meldet sich mit genau dieser Google-Adresse an und landet direkt
   im Akquise-Tool — ohne weitere Menüpunkte.
3. Entzogen wird ein Zugang über dasselbe Feld; er greift sofort nicht mehr.

Die Trennung wird nicht in der Oberfläche entschieden, sondern in
`firestore.rules`. Nach Änderungen an der Datei müssen die Regeln deployt werden:

```bash
firebase deploy --only firestore:rules
```

Beim ersten Start nach dem Update wandern vorhandene Leads automatisch aus
`data/main` in `data/akquise`. Das Akquise-Dokument legt nur der Inhaber an —
er sollte die App also einmal öffnen, bevor sich ein Mitglied anmeldet.

## Daten

Alle Daten werden im LocalStorage des Browsers gespeichert. Regelmäßige JSON-Backups können unter **Einstellungen → Exportieren** erstellt werden.

> **Hinweis:** Projektmanagement ist für eine spätere Version geplant.
