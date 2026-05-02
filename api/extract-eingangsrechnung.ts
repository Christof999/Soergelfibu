import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ExtractBody {
  pdfBase64: string;
  mimeType?: string;
}

/**
 * PDF einer Eingangsrechnung auslesen (Gemini Vision).
 * Env: GEMINI_API_KEY
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

  const { pdfBase64, mimeType = 'application/pdf' } = (req.body ?? {}) as ExtractBody;
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return res.status(400).json({ error: 'pdfBase64 fehlt' });
  }

  const prompt = `Du siehst eine Eingangsrechnung (PDF). Extrahiere für die Buchhaltung folgende Felder.

Antworte ausschließlich als JSON (kein Markdown):
{
  "lieferant": "Firmenname des Lieferanten / Verkäufers",
  "rechnungsnummer": "Rechnungs-/Belegnummer",
  "betragBrutto": 123.45,
  "faelligAm": "yyyy-mm-dd oder leerer String wenn unbekannt",
  "notizen": "kurzer optionaler Hinweis (z.B. Skonto, Leistungszeitraum)"
}

Regeln:
- betragBrutto: Endbetrag BRUTTO in EUR als Zahl (Punkt als Dezimaltrennzeichen). Wenn nur Netto+MwSt., rechne brutto.
- faelligAm: nur wenn ein konkretes Datum erkennbar, sonst "".
- Erfinde keine Nummern — wenn unsicher, notizen erwähnen.`;

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
                  inlineData: {
                    mimeType: mimeType.includes('/') ? mimeType : 'application/pdf',
                    data: pdfBase64.replace(/^data:[^;]+;base64,/, ''),
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
      return res.status(500).json({ error: `Gemini: ${errMsg}` });
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
      const m = rawText.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    return res.status(200).json({
      lieferant: String(parsed.lieferant ?? '').trim(),
      rechnungsnummer: String(parsed.rechnungsnummer ?? '').trim(),
      betragBrutto: typeof parsed.betragBrutto === 'number' && !Number.isNaN(parsed.betragBrutto)
        ? parsed.betragBrutto
        : parseFloat(String(parsed.betragBrutto ?? '').replace(',', '.')) || 0,
      faelligAm: String(parsed.faelligAm ?? '').trim(),
      notizen: String(parsed.notizen ?? '').trim(),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Extraktion fehlgeschlagen', detail: String(e) });
  }
}
