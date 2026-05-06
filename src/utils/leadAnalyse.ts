import type { LeadAnalyse, OptimierungPunkt } from '../types';

/** Ein Feld enthält versehentlich komplette JSON-Rohantwort statt eines Punktes */
function tryUnpackVollesOptimierungenJson(s: string): (string | OptimierungPunkt)[] | null {
  const t = s.trim();
  if (!t.startsWith('{') || !t.includes('"optimierungen"')) return null;
  try {
    const j = JSON.parse(t) as { optimierungen?: unknown[] };
    if (Array.isArray(j.optimierungen)) {
      return j.optimierungen.slice(0, 3).map(item => {
        if (item && typeof item === 'object' && ('empfehlung' in item || 'titel' in item)) {
          const o = item as OptimierungPunkt;
          return { titel: String(o.titel ?? '').trim(), empfehlung: String(o.empfehlung ?? '').trim() };
        }
        return String(item ?? '').trim();
      });
    }
  } catch {
    return null;
  }
  return null;
}

/** Rohdaten aus der Analyse-API (Strings oder Objekte) in Speicherform bringen */
export function normalizeOptimierungenFromApi(raw: unknown): (string | OptimierungPunkt)[] {
  if (!Array.isArray(raw)) return [];
  let arr = [...raw];
  if (arr.length === 1 && typeof arr[0] === 'string') {
    const unpacked = tryUnpackVollesOptimierungenJson(arr[0]);
    if (unpacked && unpacked.length > 0) arr = unpacked;
  }
  return arr.slice(0, 3).map(item => {
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

/** Verhindert Anzeige von JSON-Müll als „Zusammenfassung“ (ältere/fehlerhafte Speicherstände). */
export function sanitizeAnalyseZusammenfassungDisplay(s: string): string {
  const t = s.trim();
  if (t.startsWith('{') && /"optimierungen"\s*:/.test(t)) {
    return 'Die Kurzfassung ist technisch fehlerhaft. Bitte „KI-Analyse“ erneut ausführen.';
  }
  return s;
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
