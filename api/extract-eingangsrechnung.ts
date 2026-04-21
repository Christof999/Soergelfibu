import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Extrahiert strukturierte Felder aus einer PDF-Rechnung (Gemini multimodal).
 * Request: POST JSON { pdfBase64: string } — reines Base64 ohne data-URL-Präfix.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });
  }

  let pdfBase64 = (req.body as { pdfBase64?: string })?.pdfBase64 ?? '';
  if (pdfBase64.includes(',')) pdfBase64 = pdfBase64.split(',')[1] ?? pdfBase64;
  pdfBase64 = pdfBase64.replace(/\s/g, '');

  if (!pdfBase64 || pdfBase64.length < 100) {
    return res.status(400).json({ error: 'Ungültige oder leere PDF-Daten (Base64).' });
  }

  // Grobes Limit ~6 MB Base64 (Vercel Body-Limit beachten)
  if (pdfBase64.length > 8_000_000) {
    return res.status(413).json({ error: 'PDF zu groß (max. ca. 4–5 MB Datei).' });
  }

  const prompt = `Du siehst eine Eingangsrechnung (PDF). Extrahiere die folgenden Felder für eine Buchhaltungs-Erfassung.

Regeln:
- Erfinde keine Werte. Wenn etwas fehlt, setze einen leeren String "" oder 0 bzw. ein plausibles Datum nur wenn auf der Rechnung erkennbar.
- lieferant: Firmenname des Rechnungsstellers / Gläubigers
- rechnungsnummer: Rechnungsnummer wie auf dem Dokument
- betragBrutto: Zahlbetrag in EUR als Zahl (Komma als Punkt), typischerweise Endbetrag brutto inkl. MwSt.
- faelligAm: Fälligkeitsdatum im Format yyyy-mm-dd. Wenn nur ein Rechnungsdatum existiert und kein separates Fälligkeitsdatum, nutze das Zahlungsziel aus dem Text (z. B. +14 Tage) oder leerer String.
- notizen: Kurz Stichworte (z. B. Leistungszeitraum), max. 2 Sätze, oder ""

Antworte ausschließlich als JSON:
{
  "lieferant": "",
  "rechnungsnummer": "",
  "betragBrutto": 0,
  "faelligAm": "",
  "notizen": ""
}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'application/pdf',
                    data: pdfBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      const errMsg = geminiData?.error?.message ?? JSON.stringify(geminiData);
      return res.status(500).json({ error: `Gemini API Fehler: ${errMsg}` });
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    let parsed: {
      lieferant?: string;
      rechnungsnummer?: string;
      betragBrutto?: number;
      faelligAm?: string;
      notizen?: string;
    };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const betrag = typeof parsed.betragBrutto === 'number' && !Number.isNaN(parsed.betragBrutto)
      ? parsed.betragBrutto
      : parseFloat(String(parsed.betragBrutto ?? '0').replace(',', '.')) || 0;

    let faellig = String(parsed.faelligAm ?? '').trim();
    if (faellig && !/^\d{4}-\d{2}-\d{2}$/.test(faellig)) {
      faellig = '';
    }

    return res.status(200).json({
      lieferant: String(parsed.lieferant ?? '').trim(),
      rechnungsnummer: String(parsed.rechnungsnummer ?? '').trim(),
      betragBrutto: betrag,
      faelligAm: faellig,
      notizen: String(parsed.notizen ?? '').trim(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Interner Fehler', detail: String(err) });
  }
}
