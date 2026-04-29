import type { Dokument } from '../types';

/** Datum yyyy-mm-dd + Tage (ohne Zeitzonen-Sprünge) */
export function addDaysIso(dateIso: string, days: number): string {
  const base = dateIso.slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Payload für eine Rechnung, die aus einem angenommenen Angebot erzeugt wird */
export function buildRechnungAusAngebot(angebot: Dokument): Omit<Dokument, 'id' | 'nummer' | 'erstelltAm' | 'geaendertAm'> {
  const datum = new Date().toISOString().slice(0, 10);
  const zt = angebot.zahlungsziel ?? 14;
  const faelligAm = addDaysIso(datum, zt);
  return {
    typ: 'rechnung',
    kundeId: angebot.kundeId,
    datum,
    faelligAm,
    betreff: angebot.betreff
      ? `Rechnung zu ${angebot.nummer}: ${angebot.betreff}`
      : `Rechnung zu ${angebot.nummer}`,
    notizen: angebot.notizen
      ? `Aus Angebot ${angebot.nummer}\n${angebot.notizen}`
      : `Aus Angebot ${angebot.nummer}`,
    positionen: angebot.positionen.map(p => ({ ...p })),
    status: 'gesendet',
    zahlungsziel: zt,
    skonto: angebot.skonto,
    quelleAngebotId: angebot.id,
  };
}
