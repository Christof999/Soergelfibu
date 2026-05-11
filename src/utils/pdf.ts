import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dokument, Firma, Kunde } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { berechneGesamtsummen } from './berechnungen';
import { KLEINUNTERNEHMER_HINWEIS_USTG } from './steuern';

// Anthrazit-Palette
const ANTHRAZIT: [number, number, number] = [45, 55, 72];
const ANTHRAZIT_LIGHT: [number, number, number] = [75, 85, 99];
const ANTHRAZIT_ROW: [number, number, number] = [243, 244, 246];

function fmtDate(iso: string) {
  return format(new Date(iso), 'dd.MM.yyyy', { locale: de });
}

function fmtEur(value: number) {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function generatePDF(dokument: Dokument, firma: Firma, kunde: Kunde) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ku = !!firma.kleinunternehmerRegelung;
  const { netto, brutto } = berechneGesamtsummen(dokument.positionen, ku);
  const typLabel = dokument.typ === 'angebot' ? 'Angebot' : 'Rechnung';
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Kopfzeile: Firmenname
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...ANTHRAZIT);
  doc.text(firma.name, margin, 22);

  // Firmenadresse rechts
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  const firmaInfo = [
    firma.strasse,
    `${firma.plz} ${firma.ort}`,
    firma.land,
    `Tel: ${firma.telefon}`,
    `E-Mail: ${firma.email}`,
    firma.website ? `Web: ${firma.website}` : '',
    !ku && firma.ustId ? `USt-Id: ${firma.ustId}` : '',
  ].filter(Boolean);
  doc.text(firmaInfo, pageWidth - margin, 14, { align: 'right' });

  // Trennlinie
  doc.setDrawColor(...ANTHRAZIT_LIGHT);
  doc.setLineWidth(0.5);
  doc.line(margin, 38, pageWidth - margin, 38);

  // Empfänger-Anschrift
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`${firma.name} · ${firma.strasse} · ${firma.plz} ${firma.ort}`, margin, 46);

  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(kunde.firma || kunde.ansprechpartner, margin, 53);
  doc.setFont('helvetica', 'normal');
  const empfaenger = [
    kunde.ansprechpartner,
    kunde.strasse,
    `${kunde.plz} ${kunde.ort}`,
    kunde.land,
  ].filter(Boolean);
  doc.text(empfaenger, margin, 58);

  // Dokumentdetails rechts
  const detailsX = pageWidth / 2 + 10;
  let detailY = 46;
  const addDetail = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(label, detailsX, detailY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(value, pageWidth - margin, detailY, { align: 'right' });
    detailY += 6;
  };
  addDetail('Kundennummer:', kunde.kundennummer);
  addDetail(`${typLabel}-Nr.:`, dokument.nummer);
  addDetail('Datum:', fmtDate(dokument.datum));
  if (dokument.gueltigBis) addDetail('Gültig bis:', fmtDate(dokument.gueltigBis));
  if (dokument.faelligAm) addDetail('Fällig am:', fmtDate(dokument.faelligAm));

  // Titel
  let y = 85;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...ANTHRAZIT);
  doc.text(`${typLabel} ${dokument.nummer}`, margin, y);
  y += 6;

  if (dokument.betreff) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(`Betreff: ${dokument.betreff}`, margin, y);
    y += 8;
  } else {
    y += 4;
  }

  // Positionstabelle
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [[
      'Pos.',
      'Bezeichnung',
      'Menge',
      'Einheit',
      ku ? 'Einzelpreis (Endbetrag)' : 'Einzelpreis',
      'Rabatt',
      ku ? 'Betrag' : 'Gesamt',
    ]],
    body: dokument.positionen.map((pos, idx) => {
      const nettoBetrag = pos.menge * pos.einzelpreis * (1 - pos.rabatt / 100);
      return [
        String(idx + 1),
        pos.beschreibung ? `${pos.bezeichnung}\n${pos.beschreibung}` : pos.bezeichnung,
        pos.menge.toLocaleString('de-DE'),
        pos.einheit,
        fmtEur(pos.einzelpreis),
        pos.rabatt > 0 ? `${pos.rabatt}%` : '–',
        fmtEur(nettoBetrag),
      ];
    }),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: ANTHRAZIT, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ANTHRAZIT_ROW },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: 'right', cellWidth: 16 },
      3: { cellWidth: 16 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 26 },
    },
  });

  // Summenblock
  const tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const sumX = pageWidth - margin - 70;
  let sy = tableEndY + 8;

  const addSumRow = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...(color ?? ([30, 30, 30] as [number, number, number])));
    doc.text(label, sumX, sy);
    doc.text(value, pageWidth - margin, sy, { align: 'right' });
    sy += 6.5;
  };

  if (ku) {
    if (dokument.skonto > 0) {
      addSumRow(`Skonto ${dokument.skonto}%:`, `– ${fmtEur(brutto * dokument.skonto / 100)}`);
    }
    sy += 1;
    doc.setDrawColor(...ANTHRAZIT_LIGHT);
    doc.setLineWidth(0.4);
    doc.line(sumX, sy, pageWidth - margin, sy);
    sy += 5;
    addSumRow('Gesamtbetrag:', fmtEur(brutto), true, ANTHRAZIT);
  } else {
    addSumRow('Nettobetrag:', fmtEur(netto));

    const mwstGruppen = new Map<number, number>();
    dokument.positionen.forEach(pos => {
      const betrag = pos.menge * pos.einzelpreis * (1 - pos.rabatt / 100);
      mwstGruppen.set(pos.mwstSatz, (mwstGruppen.get(pos.mwstSatz) ?? 0) + betrag * (pos.mwstSatz / 100));
    });
    mwstGruppen.forEach((betrag, satz) => addSumRow(`MwSt. ${satz}%:`, fmtEur(betrag)));

    if (dokument.skonto > 0) {
      addSumRow(`Skonto ${dokument.skonto}%:`, `– ${fmtEur(brutto * dokument.skonto / 100)}`);
    }

    sy += 1;
    doc.setDrawColor(...ANTHRAZIT_LIGHT);
    doc.setLineWidth(0.4);
    doc.line(sumX, sy, pageWidth - margin, sy);
    sy += 5;
    addSumRow('Gesamtbetrag:', fmtEur(brutto), true, ANTHRAZIT);
  }

  // Fußtext
  let footY = Math.max(sy + 12, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);

  if (dokument.notizen) {
    doc.text('Hinweise:', margin, footY);
    footY += 5;
    doc.setTextColor(30, 30, 30);
    const splitNotes = doc.splitTextToSize(dokument.notizen, pageWidth - 2 * margin);
    doc.text(splitNotes, margin, footY);
    footY += splitNotes.length * 5 + 4;
  }

  if (dokument.typ === 'rechnung') {
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Bitte überweisen Sie ${fmtEur(brutto)} bis zum ${dokument.faelligAm ? fmtDate(dokument.faelligAm) : '–'} auf folgendes Konto:`,
      margin,
      footY,
    );
    footY += 5;
    doc.setTextColor(30, 30, 30);
    doc.text(`IBAN: ${firma.iban}  |  BIC: ${firma.bic}  |  ${firma.bank}`, margin, footY);
    footY += 8;
  }

  if (ku) {
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const kuLines = doc.splitTextToSize(KLEINUNTERNEHMER_HINWEIS_USTG, pageWidth - 2 * margin);
    doc.text(kuLines, margin, footY);
    footY += kuLines.length * 4 + 6;
  }

  // Fußzeile
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${firma.name}  ·  Steuernr: ${firma.steuernummer}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  );

  doc.save(`${dokument.nummer}.pdf`);
}
