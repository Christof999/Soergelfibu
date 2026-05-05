import { Dokumentposition } from '../types';

export function berechneZeile(pos: Dokumentposition, kleinunternehmer = false) {
  const netto = pos.menge * pos.einzelpreis * (1 - pos.rabatt / 100);
  if (kleinunternehmer) {
    return { netto, mwst: 0, brutto: netto };
  }
  const mwst = netto * (pos.mwstSatz / 100);
  return { netto, mwst, brutto: netto + mwst };
}

export function berechneGesamtsummen(positionen: Dokumentposition[], kleinunternehmer = false) {
  return positionen.reduce(
    (acc, pos) => {
      const { netto, mwst, brutto } = berechneZeile(pos, kleinunternehmer);
      return {
        netto: acc.netto + netto,
        mwstBetrag: acc.mwstBetrag + mwst,
        brutto: acc.brutto + brutto,
      };
    },
    { netto: 0, mwstBetrag: 0, brutto: 0 },
  );
}

export function fmtEur(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
