import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Alles in einer Datei: weniger Bundling-Probleme auf Vercel. */

function parseBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body as unknown;
  if (b == null) return {};
  if (typeof b === 'string') {
    try {
      const j = JSON.parse(b) as unknown;
      return typeof j === 'object' && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
  return {};
}

function normalisiereWebsiteUrl(roh: string): string | null {
  const t = roh.trim();
  if (!t) return null;
  try {
    const mitSchema = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(mitSchema);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.replace(/^www\./i, '');
    if (!host || host.length < 2 || !host.includes('.')) return null;
    return u.href;
  } catch {
    return null;
  }
}

function basisAusUrl(absUrl: string): string | null {
  try {
    const u = new URL(absUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function htmlZuKlartext(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSeiteHttp(url: string, timeoutMs = 6500): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const html = await res.text();
    return htmlZuKlartext(html);
  } catch {
    clearTimeout(timer);
    return '';
  }
}

async function ladeSeitenParallel(hauptUrl: string, impressumKandidaten: string[]) {
  const MAX_IMPRESSUM = 6;
  const urls = [hauptUrl, ...impressumKandidaten.slice(0, MAX_IMPRESSUM)];
  const texts = await Promise.all(urls.map(u => fetchSeiteHttp(u, 6500)));
  const startseite = (texts[0] ?? '').slice(0, 4500);
  let impressum = '';
  for (let i = 1; i < texts.length; i++) {
    if (texts[i].length > 100) {
      impressum = texts[i];
      break;
    }
  }
  return {
    startseite,
    impressum: impressum.slice(0, 2200),
  };
}

interface GeminiParsed {
  optimierungen?: unknown[];
  ansprechpartner?: string;
  zusammenfassung?: string;
  websiteGeladen?: boolean;
}

function parseGeminiJson(rawText: string): GeminiParsed {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as GeminiParsed;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as GeminiParsed;
      } catch {
        /* Fallback */
      }
    }
    return {
      optimierungen: ['Analyse konnte nicht ausgewertet werden – die KI-Antwort war kein gültiges JSON.'],
      ansprechpartner: '',
      zusammenfassung: trimmed.slice(0, 200) || 'Keine Auswertung möglich.',
      websiteGeladen: false,
    };
  }
}

function optimierungenAusAntwort(raw: unknown[]): (string | { titel: string; empfehlung: string })[] {
  return raw.slice(0, 3).map(item => {
    if (item && typeof item === 'object' && item !== null && ('empfehlung' in item || 'titel' in item)) {
      const o = item as { titel?: string; empfehlung?: string };
      return {
        titel: String(o.titel ?? '').trim(),
        empfehlung: String(o.empfehlung ?? '').trim(),
      };
    }
    return String(item ?? '').trim();
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = parseBody(req);
    const website = String(body.website ?? '');
    const name = String(body.name ?? '');
    const branche = body.branche != null ? String(body.branche) : '';

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

    let hauptseite = '';
    let impressum = '';
    const fetchMethode = 'http' as const;
    const hauptUrlNorm = normalisiereWebsiteUrl(website);

    if (hauptUrlNorm) {
      const basis = basisAusUrl(hauptUrlNorm);
      if (basis) {
        const impressumKandidaten = [
          `${basis}/impressum`,
          `${basis}/impressum.html`,
          `${basis}/impressum.php`,
          `${basis}/ueber-uns`,
          `${basis}/kontakt`,
          `${basis}/de/impressum`,
          `${basis}/legal/imprint`,
        ];
        const geladen = await ladeSeitenParallel(hauptUrlNorm, impressumKandidaten);
        hauptseite = geladen.startseite;
        impressum = geladen.impressum;
      }
    }

    const hatInhalt = hauptseite.length > 50 || impressum.length > 50;

    const kontextHerkunft =
      'Der Seiteninhalt wurde per HTTP abgerufen (ohne JavaScript; dynamische Inhalte können fehlen).';

    const prompt = `Du bist ein erfahrener SEO- und Webdesign-Spezialist UND denkst gleichzeitig aus Sicht eines typischen Webseitenbesuchers (Handwerk/B2B).

Unternehmen: ${name}
Branche: ${branche || 'Unbekannt'}
Website: ${hauptUrlNorm ?? website.trim() || 'keine Website angegeben'}

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
6. Für jeden Optimierungspunkt: kurzer Titel (Überschrift), darunter die konkrete Empfehlung (1–2 Sätze).

Antworte ausschließlich als JSON (kein Markdown):
{
  "optimierungen": [
    { "titel": "Kurze Überschrift für Punkt 1", "empfehlung": "Konkrete Empfehlung als Fließtext." },
    { "titel": "…", "empfehlung": "…" },
    { "titel": "…", "empfehlung": "…" }
  ],
  "ansprechpartner": "Name aus Impressum oder leerer String",
  "zusammenfassung": "Was macht das Unternehmen und warum Lead-interessant (1-2 Sätze, nur Belegtes)",
  "websiteGeladen": ${hatInhalt}
}`;

    const geminiCtrl = new AbortController();
    const geminiTimer = setTimeout(() => geminiCtrl.abort(), 45_000);
    let geminiRes: Response;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          signal: geminiCtrl.signal,
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
    } catch (e) {
      return res.status(504).json({
        error: 'Gemini-Anfrage fehlgeschlagen oder Zeitüberschreitung (45s).',
        detail: e instanceof Error ? e.message : String(e),
      });
    } finally {
      clearTimeout(geminiTimer);
    }

    let geminiData: unknown;
    try {
      geminiData = await geminiRes.json();
    } catch {
      return res.status(502).json({
        error: 'Gemini-Antwort war kein gültiges JSON (Netzwerk oder Proxy). Bitte erneut versuchen.',
      });
    }

    if (!geminiRes.ok) {
      const errMsg =
        typeof geminiData === 'object' &&
        geminiData !== null &&
        'error' in geminiData &&
        typeof (geminiData as { error?: { message?: string } }).error?.message === 'string'
          ? (geminiData as { error: { message: string } }).error.message
          : JSON.stringify(geminiData);
      return res.status(500).json({ error: `Gemini API Fehler: ${errMsg}` });
    }

    const g = geminiData as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = g.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    const parsed = parseGeminiJson(rawText);
    const opts = optimierungenAusAntwort(Array.isArray(parsed.optimierungen) ? parsed.optimierungen : []);

    return res.status(200).json({
      optimierungen: opts,
      ansprechpartner: parsed.ansprechpartner ?? '',
      zusammenfassung: parsed.zusammenfassung ?? '',
      websiteGeladen: hatInhalt,
      analysiertAm: new Date().toISOString(),
      seitenabrufMethode: fetchMethode,
    });
  } catch (err) {
    console.error('api/analyse:', err);
    return res.status(500).json({
      error: 'Interner Fehler bei der Analyse',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
