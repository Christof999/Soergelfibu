import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { website, name, branche } = req.body as {
    website: string;
    name: string;
    branche?: string;
  };

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

  // Website-Inhalt laden (mit Timeout)
  let websiteInhalt = '';
  if (website) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 8000);
      const htmlRes = await fetch(website.startsWith('http') ? website : `https://${website}`, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AkquiseTool/1.0)' },
      });
      clearTimeout(timeout);
      const html = await htmlRes.text();
      // HTML bereinigen – nur Text extrahieren
      websiteInhalt = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 6000);
    } catch {
      websiteInhalt = 'Website konnte nicht geladen werden.';
    }
  }

  const prompt = `Du bist ein Experte für digitales Marketing und Webdesign. Analysiere folgendes Unternehmen und seine Website.

Unternehmen: ${name}
Branche: ${branche ?? 'Unbekannt'}
Website: ${website || 'keine Website'}

Website-Inhalt (Auszug):
${websiteInhalt || 'Kein Inhalt verfügbar'}

Bitte gib genau folgendes zurück (als JSON, kein Markdown):
{
  "optimierungen": [
    "Konkrete Optimierung 1 (max. 2 Sätze)",
    "Konkrete Optimierung 2 (max. 2 Sätze)",
    "Konkrete Optimierung 3 (max. 2 Sätze)"
  ],
  "ansprechpartner": "Name des Inhabers/Ansprechpartners aus dem Impressum oder leerem String",
  "zusammenfassung": "1-2 Sätze: Was macht das Unternehmen, warum ist es ein guter Lead?"
}

Fokus der Optimierungen: Website-Performance, SEO, moderne Darstellung, Conversion-Optimierung, fehlende Elemente. Sei konkret und auf das Unternehmen bezogen.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(500).json({ error: 'Gemini API Fehler', detail: geminiData });
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    let parsed: { optimierungen: string[]; ansprechpartner: string; zusammenfassung: string };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fallback: versuche JSON aus dem Text zu extrahieren
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {
        optimierungen: ['Analyse konnte nicht vollständig durchgeführt werden.'],
        ansprechpartner: '',
        zusammenfassung: rawText.slice(0, 200),
      };
    }

    return res.status(200).json({
      optimierungen: parsed.optimierungen?.slice(0, 3) ?? [],
      ansprechpartner: parsed.ansprechpartner ?? '',
      zusammenfassung: parsed.zusammenfassung ?? '',
      analysiertAm: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Interner Fehler', detail: String(err) });
  }
}
