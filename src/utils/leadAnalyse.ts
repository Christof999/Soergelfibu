import type { LeadAnalyse, OptimierungPunkt } from '../types';

/** Rohdaten aus der Analyse-API (Strings oder Objekte) in Speicherform bringen */
export function normalizeOptimierungenFromApi(raw: unknown): (string | OptimierungPunkt)[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).map(item => {
    if (item && typeof item === 'object' && ('empfehlung' in item || 'titel' in item)) {
      const o = item as OptimierungPunkt;
      return {
        titel: String(o.titel ?? '').trim(),
        empfehlung: String(o.empfehlung ?? '').trim(),
      };
    }
    return String(item ?? '').trim();
  });
}

/** Einzelnen Analyse-Eintrag (String aus Altbestand oder Objekt) normalisieren */
export function parseOptimierungPunkt(
  item: string | OptimierungPunkt | null | undefined,
  index: number
): OptimierungPunkt {
  if (item && typeof item === 'object' && 'empfehlung' in item) {
    const titel = String((item as OptimierungPunkt).titel ?? '').trim();
    const empfehlung = String((item as OptimierungPunkt).empfehlung ?? '').trim();
    return {
      titel: titel || `Empfehlung ${index + 1}`,
      empfehlung,
    };
  }
  const s = String(item ?? '').trim();
  if (!s) {
    return { titel: `Empfehlung ${index + 1}`, empfehlung: '' };
  }
  // Legacy: ein String – Titel am Gedankenstrich oder erstem Satzende
  const dash = s.match(/^(.+?)\s*[–—-]\s+(.+)$/s);
  if (dash && dash[1].length <= 90) {
    return { titel: dash[1].trim(), empfehlung: dash[2].trim() };
  }
  const dotIdx = s.search(/[.!?]/);
  if (dotIdx >= 8 && dotIdx < s.length - 15) {
    return {
      titel: s.slice(0, dotIdx + 1).trim(),
      empfehlung: s.slice(dotIdx + 1).trim(),
    };
  }
  return { titel: `Empfehlung ${index + 1}`, empfehlung: s };
}

/** Genau 3 Punkte für E-Mail / UI (Lücken mit leeren Strings auffüllen) */
export function normalizeOptimierungenListe(
  raw: LeadAnalyse['optimierungen'] | undefined
): [OptimierungPunkt, OptimierungPunkt, OptimierungPunkt] {
  const arr = raw ?? [];
  const a = parseOptimierungPunkt(arr[0], 0);
  const b = parseOptimierungPunkt(arr[1], 1);
  const c = parseOptimierungPunkt(arr[2], 2);
  return [a, b, c];
}
