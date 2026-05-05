import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ladeSeiteninhalte } from './analyse-page-fetch';

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

  let hauptseite = '';
  let impressum = '';
  let fetchMethode: 'browserbase' | 'http' = 'http';
  const hatWebsite = !!website?.trim();

  if (hatWebsite) {
    const basis = basisUrl(website);
    const hauptUrl = website.startsWith('http') ? website.trim() : `https://${website.trim()}`;

    const impressumKandidaten = [
      `${basis}/impressum`,
      `${basis}/impressum.html`,
      `${basis}/impressum.php`,
      `${basis}/ueber-uns`,
      `${basis}/kontakt`,
      `${basis}/de/impressum`,
      `${basis}/legal/imprint`,
    ];

    const geladen = await ladeSeiteninhalte({ hauptUrl, impressumKandidaten });
    hauptseite = geladen.startseite;
    impressum = geladen.impressum;
    fetchMethode = geladen.methode;
  }

  const hatInhalt = hauptseite.length > 50 || impressum.length > 50;

  const kontextHerkunft =
    fetchMethode === 'browserbase'
      ? 'Der Seiteninhalt wurde mit einem echten Browser geladen (sichtbarer Text wie für Nutzer).'
      : 'Der Seiteninhalt wurde per HTTP abgerufen (ohne JavaScript; dynamische Inhalte können fehlen).';

  const prompt = `Du bist ein erfahrener SEO- und Webdesign-Spezialist UND denkst gleichzeitig aus Sicht eines typischen Webseitenbesuchers (Handwerk/B2B).

Unternehmen: ${name}
Branche: ${branche ?? 'Unbekannt'}
Website: ${website || 'keine Website angegeben'}

Technischer Kontext: ${kontextHerkunft}

=== INHALT DER STARTSEITE ===
${hauptseite || '(Leer oder nicht erreichbar)'}

=== IMPRESSUM / KONTAKT (falls gefunden) ===
${impressum || '(Nicht gefunden)'}

AUFGABE – zwei kurze Perspektiven in den drei Optimierungspunkten verbinden:
- Nutzenperspektive: Was wirkt für einen Besucher unklar, unnötig hürdenreich oder wenig vertrauensbildend – soweit aus dem Text ableitbar?
- Fachperspektive: Was wäre aus SEO/UX/Webdesign-Sicht der nächste sinnvolle Schritt – ohne Fantasie-Zahlen?

STRENGE REGELN:
1. Erfinde keine Fakten. Nur was sich aus dem Text ableiten lässt.
2. Ansprechpartner nur wenn explizit im Impressum/Kontakt-Text genannt, sonst "".
3. Keine konkreten Behauptungen zu „mobiler Ansicht“, „Ladezeit“ oder „Farben“, wenn der gelieferte Text dazu nichts hergibt (bei reinem Textabruf oft nicht belegbar).
4. Wenn kaum Inhalt vorliegt, formuliere allgemeinere aber noch immer sinnvolle Punkte zur Digitalpräsenz und verweise darauf, dass eine tiefergehende Prüfung der Live-Seite sinnvoll ist – ohne zu behaupten, du hättest sie gesehen.
5. Formuliere die drei Optimierungen als klare Empfehlungen (Du/Sie-Kontext zum Unternehmen).

Antworte ausschließlich als JSON (kein Markdown):
{
  "optimierungen": [
    "Optimierung 1 – konkret und auf dieses Unternehmen bezogen (1-2 Sätze)",
    "Optimierung 2 – konkret und auf dieses Unternehmen bezogen (1-2 Sätze)",
    "Optimierung 3 – konkret und auf dieses Unternehmen bezogen (1-2 Sätze)"
  ],
  "ansprechpartner": "Name aus Impressum oder leerer String",
  "zusammenfassung": "Was macht das Unternehmen und warum Lead-interessant (1-2 Sätze, nur Belegtes)",
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
      /** Debug: wie die Seiten geladen wurden */
      seitenabrufMethode: fetchMethode,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Interner Fehler', detail: String(err) });
  }
}
