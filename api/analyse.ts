import type { VercelRequest, VercelResponse } from '@vercel/node';

async function fetchSeite(url: string, timeoutMs = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
    clearTimeout(t);
    if (!res.ok) return '';
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    clearTimeout(t);
    return '';
  }
}

function basisUrl(website: string): string {
  const url = website.startsWith('http') ? website : `https://${website}`;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { website, name, branche } = req.body as {
    website: string;
    name: string;
    branche?: string;
  };

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

  // Hauptseite + Impressum parallel laden
  let hauptseite = '';
  let impressum = '';
  const hatWebsite = !!website;

  if (hatWebsite) {
    const basis = basisUrl(website);
    const hauptUrl = website.startsWith('http') ? website : `https://${website}`;

    // Impressum-Kandidaten (häufige deutsche URLs)
    const impressumKandidaten = [
      `${basis}/impressum`,
      `${basis}/impressum.html`,
      `${basis}/impressum.php`,
      `${basis}/ueber-uns`,
      `${basis}/kontakt`,
    ];

    [hauptseite, ...([impressum] = await Promise.all([
      fetchSeite(hauptUrl),
      // Ersten erfolgreichen Impressum-Kandidaten verwenden
      (async () => {
        for (const u of impressumKandidaten) {
          const text = await fetchSeite(u, 5000);
          if (text.length > 100) return text;
        }
        return '';
      })(),
    ]))] ;

    hauptseite = hauptseite.slice(0, 4000);
    impressum = impressum.slice(0, 2000);
  }

  const hatInhalt = hauptseite.length > 50 || impressum.length > 50;

  const prompt = `Du bist ein Experte für digitales Marketing und Webdesign. Analysiere folgendes Unternehmen.

Unternehmen: ${name}
Branche: ${branche ?? 'Unbekannt'}
Website: ${website || 'keine Website angegeben'}

=== INHALT DER STARTSEITE (automatisch abgerufen) ===
${hauptseite || 'Konnte nicht geladen werden (z.B. Bot-Schutz oder Timeout)'}

=== IMPRESSUM / KONTAKT (automatisch abgerufen) ===
${impressum || 'Nicht gefunden'}

WICHTIGE REGELN – halte dich STRIKT daran:
1. Erfinde KEINE Fakten. Wenn etwas nicht aus dem Seiteninhalt hervorgeht, schreib es NICHT.
2. Ansprechpartner: Nur angeben wenn ein konkreter Name im Impressum steht. Sonst leerer String "".
3. Responsivität/Design: Beurteile NUR was aus dem Text erkennbar ist. Mache KEINE Annahmen über das visuelle Design.
4. Wenn die Website nicht geladen werden konnte, analysiere nur anhand des Unternehmensnamens und der Branche.
5. Optimierungen sollen KONKRET und UMSETZBAR sein, nicht generisch.

Antworte ausschließlich als JSON (kein Markdown, kein Text drumherum):
{
  "optimierungen": [
    "Optimierung 1 – konkret und auf dieses Unternehmen bezogen (1-2 Sätze)",
    "Optimierung 2 – konkret und auf dieses Unternehmen bezogen (1-2 Sätze)",
    "Optimierung 3 – konkret und auf dieses Unternehmen bezogen (1-2 Sätze)"
  ],
  "ansprechpartner": "Vollständiger Name aus dem Impressum oder leerer String",
  "zusammenfassung": "Was macht das Unternehmen und warum ist es als Lead interessant? (1-2 Sätze, nur belegte Fakten)",
  "websiteGeladen": ${hatInhalt}
}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
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
      optimierungen: string[];
      ansprechpartner: string;
      zusammenfassung: string;
      websiteGeladen?: boolean;
    };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {
        optimierungen: ['Analyse konnte nicht durchgeführt werden.'],
        ansprechpartner: '',
        zusammenfassung: rawText.slice(0, 200),
        websiteGeladen: false,
      };
    }

    return res.status(200).json({
      optimierungen: parsed.optimierungen?.slice(0, 3) ?? [],
      ansprechpartner: parsed.ansprechpartner ?? '',
      zusammenfassung: parsed.zusammenfassung ?? '',
      websiteGeladen: hatInhalt,
      analysiertAm: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Interner Fehler', detail: String(err) });
  }
}
