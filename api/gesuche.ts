import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * „Gesuche im Netz“ (Social Listening): öffentliche Beiträge finden, in denen
 * Betriebe selbst nach Software fragen — und einen Antwortvorschlag liefern.
 *
 * 1. Gemini führt jede Suchanfrage als Google-Suche aus. Verwendet werden nur die
 *    Quellen, die Google tatsächlich geliefert hat — keine von der KI genannten URLs.
 * 2. Jede Fundstelle wird geladen: HTTP, bei Sperre (z. B. Reddit) über Geminis
 *    URL-Kontext, als letzter Versuch Browserbase.
 * 3. Gemini bewertet den echten Seitentext und schreibt den Antwortvorschlag.
 *
 * Env: GEMINI_API_KEY, optional BROWSERBASE_API_KEY (+ BROWSERBASE_PROJECT_ID).
 * Wie api/analyse.ts bewusst in einer Datei (Vercel-Bundling).
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MAX_SUCHANFRAGEN = 8;
const MAX_KANDIDATEN = 14;
const MAX_SEITENTEXT = 3000;
const MAX_HTML_CHARS = 400_000;
const BROWSERBASE_BUDGET_MS = 45_000;

const PRODUKT =
  'Drei WebApps von SØRGEL-design (soergel-design.de/software): Zeiterfassung (Stempeln aufs Projekt), ' +
  'Angebot→Rechnung→Mahnung ohne Abtippen inkl. Nachkalkulation, und ein KI-Posteingang für Belege. ' +
  'Zielgruppe: Handwerksbetriebe und kleine Firmen.';

interface GeladeneSeite {
  url: string;
  text: string;
  /** YYYY-MM-DD aus dem HTML oder leer */
  datum: string;
}

/** Spiegelt `GesuchTreffer` in src/types. */
interface GesuchTreffer {
  url: string;
  titel: string;
  quelle: string;
  datum: string;
  score: number;
  zusammenfassung: string;
  antwortVorschlag: string;
}

// ─── Hilfen ──────────────────────────────────────────────────────────────────

function htmlZuKlartext(html: string): string {
  return html
    .slice(0, MAX_HTML_CHARS)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Veröffentlichungsdatum aus dem HTML (JSON-LD, Reddit-Zeitstempel, <time>). Die KI
 * schätzte Daten aus „vor 2 Jahren“ im Test falsch, teils sogar in die Zukunft.
 */
function datumAusHtml(html: string): string {
  const roh =
    html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ??
    html.match(/created-timestamp="([^"]+)"/)?.[1] ??
    html.match(/<time[^>]*\sdatetime="([^"]+)"/)?.[1];
  const d = roh ? new Date(roh) : null;
  return d && !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() ? d.toISOString().slice(0, 10) : '';
}

/**
 * Reddit-Beitrags-IDs (Base36) steigen fortlaufend. Linear zwischen zwei bekannten Beiträgen
 * hochgerechnet liegt das Datum im Test höchstens ~10 Tage daneben — genug für den Zeitfilter.
 */
function datumAusRedditId(url: string): string {
  const id = url.match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i)?.[1];
  if (!id) return '';
  const a = { n: parseInt('1h1dmwh', 36), t: Date.UTC(2024, 10, 27) };
  const b = { n: parseInt('1pzcdab', 36), t: Date.UTC(2025, 11, 30) };
  const t = a.t + ((parseInt(id, 36) - a.n) * (b.t - a.t)) / (b.n - a.n);
  return new Date(Math.min(t, Date.now())).toISOString().slice(0, 10);
}

function quelleAusUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function gemini(body: Record<string, unknown>, key: string, timeoutMs: number) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] };
    }[];
  };
  if (!res.ok) throw new Error(`Gemini: ${data.error?.message ?? res.status}`);
  const cand = data.candidates?.[0];
  return {
    text: (cand?.content?.parts ?? []).map(p => p.text ?? '').join(''),
    quellen: (cand?.groundingMetadata?.groundingChunks ?? []).flatMap(c => (c.web?.uri ? [c.web.uri] : [])),
  };
}

/** Grounding-Quellen sind Google-Weiterleitungen; die echte URL steht im Location-Header. */
async function zielDerWeiterleitung(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    const ziel = new URL(res.headers.get('location') ?? '');
    ziel.hash = '';
    return ziel.protocol === 'https:' || ziel.protocol === 'http:' ? ziel.href : null;
  } catch {
    return null;
  }
}

async function ladeHttp(url: string): Promise<{ text: string; datum: string }> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
    });
    if (!res.ok) return { text: '', datum: '' };
    const html = await res.text();
    return { text: htmlZuKlartext(html), datum: datumAusHtml(html) };
  } catch {
    return { text: '', datum: '' };
  }
}

/**
 * Seiten, die per HTTP leer blieben, nacheinander in einer Browser-Session laden.
 * Text über innerText: Reddit-HTML ist über 1 MB, der Beitrag stünde hinter jeder Kürzung.
 */
async function ladeBrowserbase(urls: string[]): Promise<Map<string, { text: string; datum: string }>> {
  const ergebnis = new Map<string, { text: string; datum: string }>();
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey || urls.length === 0) return ergebnis;
  const { default: Browserbase } = await import('@browserbasehq/sdk');
  const { chromium } = await import('playwright-core');
  const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
  const session = await new Browserbase({ apiKey }).sessions.create({
    timeout: 60,
    region: 'eu-central-1',
    ...(projectId ? { projectId } : {}),
  });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const deadline = Date.now() + BROWSERBASE_BUDGET_MS;
  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    for (const url of urls) {
      const rest = deadline - Date.now();
      if (rest < 4000) break;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.min(15_000, rest) });
        await page.waitForTimeout(1000);
        const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();        ergebnis.set(url, { text, datum: datumAusHtml(await page.content()) });
      } catch {
        /* nächste Seite */
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return ergebnis;
}

// ─── Schritte ────────────────────────────────────────────────────────────────

/**
 * Pro Suchanfrage ein Gemini-Aufruf mit Google-Suche. Kurze, vorgegebene Anfragen sind
 * nötig: Mit einem freien Thema baute Gemini im Test überladene Anfragen ohne Treffer.
 */
async function sucheKandidaten(suchanfragen: string[], key: string): Promise<string[]> {
  const proAnfrage = await Promise.all(
    suchanfragen.map(async anfrage => {
      try {
        const { quellen } = await gemini(
          {
            contents: [{ parts: [{ text: `Führe genau diese Google-Suche aus: ${anfrage}\nFasse die Treffer kurz zusammen.` }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
          },
          key,
          25_000,
        );
        return (await Promise.all(quellen.map(zielDerWeiterleitung))).filter((u): u is string => !!u);
      } catch (e) {
        console.error(`api/gesuche Suche „${anfrage}“:`, e);
        return [];
      }
    }),
  );
  // Reihum aus jeder Anfrage nehmen, damit die Obergrenze nicht nur die erste Anfrage trifft.
  const eindeutig = new Set<string>();
  for (let i = 0; i < Math.max(0, ...proAnfrage.map(l => l.length)); i++) {
    for (const liste of proAnfrage) if (liste[i]) eindeutig.add(liste[i]);
  }
  return [...eindeutig].slice(0, MAX_KANDIDATEN);
}

/**
 * Gesperrte Seiten über Geminis URL-Kontext lesen: Google ruft die Seite selbst ab.
 * Reddit sperrt sowohl Vercel als auch Browserbase (ohne bezahlte Proxys), Google nicht.
 * Wörtliche Wiedergabe verweigert Gemini (RECITATION), daher Zusammenfassung.
 */
async function leseMitGemini(url: string, key: string): Promise<{ text: string; datum: '' } | null> {
  try {
    const { text } = await gemini(
      {
        contents: [{ parts: [{ text: `Rufe diese Seite ab: ${url}
Fasse in eigenen Worten zusammen: Titel, was die Person sucht oder kritisiert und was bisher geantwortet wurde.
Antworte nur mit JSON: {"titel":"","inhalt":""}` }] }],
        tools: [{ url_context: {} }],
        // Ohne Denkphase kam im Test bei 8 von 8 Aufrufen eine leere Antwort.
        generationConfig: { temperature: 0.2, thinkingConfig: { thinkingBudget: 512 } },
      },
      key,
      30_000,
    );
    const s = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { titel?: string; inhalt?: string };
    // Datum bewusst leer: Gemini lag im Test um Monate daneben.
    return s.inhalt ? { text: `${s.titel ?? ''}\n${s.inhalt}`, datum: '' } : null;
  } catch (e) {
    console.error(`api/gesuche URL-Kontext ${url}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Laden in Stufen: HTTP → Gemini-URL-Kontext → Browserbase. Rohseiten unter 300 Zeichen
 * sind Sperr- oder JS-Hüllen („You've been blocked by network security“).
 */
async function ladeSeiten(urls: string[], key: string): Promise<GeladeneSeite[]> {
  const geladen = new Map<string, { text: string; datum: string }>();
  const fehlend = () => urls.filter(u => !geladen.has(u));

  const http = await Promise.all(urls.map(ladeHttp));
  urls.forEach((url, i) => { if (http[i].text.length >= 300) geladen.set(url, http[i]); });

  const ohneHttp = fehlend();
  const ausGemini = await Promise.all(ohneHttp.map(url => leseMitGemini(url, key)));
  ohneHttp.forEach((url, i) => { const s = ausGemini[i]; if (s) geladen.set(url, s); });

  const ausBrowser = await ladeBrowserbase(fehlend()).catch(e => {
    console.error('api/gesuche Browserbase:', e);
    return new Map<string, { text: string; datum: string }>();
  });
  ausBrowser.forEach((s, url) => { if (s.text.length >= 300) geladen.set(url, s); });

  return urls.flatMap(url => {
    const s = geladen.get(url);
    return s ? [{ url, text: s.text.slice(0, MAX_SEITENTEXT), datum: s.datum || datumAusRedditId(url) }] : [];
  });
}

async function bewerte(seiten: GeladeneSeite[], tage: number, key: string): Promise<GesuchTreffer[]> {
  const heute = new Date().toISOString().slice(0, 10);
  const prompt = `Heute ist ${heute}. Du hilfst einem Anbieter, im Netz Menschen zu finden, die gerade aktiv nach einer Lösung suchen.

Angebot des Anbieters: ${PRODUKT}

Unten stehen geladene Seiten. Bewerte jede:
- "relevant": true nur, wenn dort eine Person oder ein Betrieb selbst nach passender Software fragt, sucht oder mit der bisherigen unzufrieden ist. Anbieterseiten, Ratgeber, Vergleichsportale ohne konkrete Nutzerbeiträge, Werbung → false.
- "titel": Titel des Beitrags bzw. Threads, wie er im Text steht.
- "score": 0–100, wie warm der Kontakt ist (konkrete aktuelle Suche + Handwerk/kleiner Betrieb = hoch).
- "zusammenfassung": 1 Satz, was die Person sucht. Nur Belegtes.
- "antwortVorschlag": öffentliche Antwort im Thread, Du-Form wie im Forum üblich, max. 4 Sätze, klingt wie ein Mensch aus dem Forum. Zuerst ein konkreter Tipp zur Frage, der auch ohne das Angebot nützt. Danach höchstens ein Satz zum eigenen Angebot, offen als Anbieter gekennzeichnet (z. B. „Transparenz: ich entwickle selbst …“), soergel-design.de/software nur wenn es wirklich passt. Keine Werbesprache, keine Aufzählung aller Funktionen.

Antworte nur mit JSON: {"bewertungen":[{"index":0,"relevant":true,"titel":"…","score":80,"zusammenfassung":"…","antwortVorschlag":"…"}]}

${seiten.map((s, i) => `=== SEITE ${i} | ${s.url}${s.datum ? ` | veröffentlicht ${s.datum}` : ''}\n${s.text}`).join('\n\n')}`;

  const { text } = await gemini(
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    key,
    45_000,
  );

  let bewertungen: unknown[] = [];
  try {
    bewertungen = (JSON.parse(text) as { bewertungen?: unknown[] }).bewertungen ?? [];
  } catch {
    throw new Error('Die KI-Bewertung war kein gültiges JSON. Bitte erneut suchen.');
  }

  const grenze = Date.now() - tage * 86_400_000;
  return bewertungen
    .flatMap(b => {
      const o = b as Record<string, unknown>;
      const seite = seiten[Number(o.index)];
      if (!seite || o.relevant !== true) return [];
      if (seite.datum && new Date(seite.datum).getTime() < grenze) return [];
      return [{
        url: seite.url,
        titel: String(o.titel ?? '').trim() || quelleAusUrl(seite.url),
        quelle: quelleAusUrl(seite.url),
        datum: seite.datum,
        score: Math.max(0, Math.min(100, Number(o.score) || 0)),
        zusammenfassung: String(o.zusammenfassung ?? ''),
        antwortVorschlag: String(o.antwortVorschlag ?? ''),
      }];
    })
    .sort((a, b) => b.score - a.score);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

  const body = (typeof req.body === 'object' && req.body) || {};
  const suchanfragen = (Array.isArray(body.suchanfragen) ? body.suchanfragen : [])
    .map((s: unknown) => String(s).trim())
    .filter(Boolean)
    .slice(0, MAX_SUCHANFRAGEN);
  if (suchanfragen.length === 0) return res.status(400).json({ error: 'Mindestens eine Suchanfrage angeben' });
  const tage = [7, 30, 90, 365].includes(Number(body.tage)) ? Number(body.tage) : 90;

  try {
    const kandidaten = await sucheKandidaten(suchanfragen, key);
    const seiten = await ladeSeiten(kandidaten, key);
    const treffer = seiten.length ? await bewerte(seiten, tage, key) : [];
    return res.status(200).json({ treffer, gefunden: kandidaten.length, geladen: seiten.length });
  } catch (err) {
    console.error('api/gesuche:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
