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

## Deployment auf Vercel

1. Repository mit Vercel verbinden
2. Framework: **Vite**
3. Build-Befehl: `npm run build`
4. Output-Verzeichnis: `dist`
5. Die `vercel.json` sorgt für korrektes SPA-Routing

## Daten

Alle Daten werden im LocalStorage des Browsers gespeichert. Regelmäßige JSON-Backups können unter **Einstellungen → Exportieren** erstellt werden.

> **Hinweis:** Projektmanagement ist für eine spätere Version geplant.
