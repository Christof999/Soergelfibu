import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get, put } from '@vercel/blob';
import webpush from 'web-push';

/**
 * „Gesuche im Netz“ (Social Listening): öffentliche Beiträge finden, in denen
 * Betriebe selbst nach Software fragen — und einen Antwortvorschlag liefern.
 * Läuft täglich per Vercel-Cron; neue Treffer kommen per E-Mail und Web-Push.
 *
 * Ein Lauf:
 * 1. Gemini führt jede Suchanfrage als Google-Suche aus. Verwendet werden nur die
 *    Quellen, die Google tatsächlich geliefert hat, und davon nur Diskussionsseiten.
 * 2. Bereits gesehene URLs fallen weg; neue werden geladen: HTTP, bei Sperre
 *    (z. B. Reddit) über Geminis URL-Kontext, als letzter Versuch Browserbase.
 * 3. Gemini bewertet den echten Seitentext und schreibt den Antwortvorschlag.
 * 4. Zustand (Einstellungen, gesehene URLs, Treffer, Push-Abos) liegt als JSON im
 *    privaten Vercel-Blob.
 *
 * Routen (eine Datei wie api/analyse.ts, wegen Vercel-Bundling):
 *   GET  ?lauf=cron              Vercel-Cron (Authorization: Bearer CRON_SECRET)
 *   GET                          Zustand für die App        ┐ nur mit Firebase-ID-Token
 *   POST { aktion: … }           Einstellungen, Lauf, Push  ┘ des Inhabers
 *
 * Env: GEMINI_API_KEY, BLOB_READ_WRITE_TOKEN, CRON_SECRET, GESUCHE_INHABER_EMAIL,
 * VITE_FIREBASE_API_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, RESEND_API_KEY,
 * RESEND_FROM_EMAIL, optional BROWSERBASE_API_KEY (+ BROWSERBASE_PROJECT_ID).
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const ZUSTAND_PFAD = 'gesuche/zustand.json';
const MAX_SUCHANFRAGEN = 30;
/** Neue URLs pro Lauf — begrenzt Laufzeit und Gemini-Aufrufe. */
const MAX_NEU_PRO_LAUF = 40;
/** Seiten pro Bewertungsaufruf — mehr sprengt Geminis Antwortlänge (8192 Token). */
const SEITEN_PRO_BEWERTUNG = 15;
const MIN_SCORE = 55;
const MAX_GESPEICHERTE_TREFFER = 200;
const GESEHEN_TAGE = 365;
const MAX_SEITENTEXT = 3000;
const MAX_HTML_CHARS = 400_000;
const BROWSERBASE_BUDGET_MS = 30_000;

/**
 * Kurze Anfragen mit „reddit“, „Forum“ oder „gutefrage“ liefern Diskussionen; ohne diese
 * Wörter kamen im Test fast nur Anbieter- und Vergleichsseiten. Die E-Rechnungspflicht
 * ist ein aktueller Anlass, zu dem viele gerade fragen.
 */
const STANDARD_SUCHANFRAGEN = [
  'reddit Handwerker Software Empfehlung',
  'reddit selbstständig Handwerkersoftware',
  'reddit Zeiterfassung App Handwerk',
  'reddit Stundenzettel App Mitarbeiter',
  'reddit E-Rechnung Software kleines Unternehmen',
  'reddit Rechnungsprogramm Kleinunternehmer Empfehlung',
  'reddit Angebote Rechnungen Software Handwerk',
  'reddit Elektriker Software Deutschland',
  'reddit Plancraft Hero Craftnote Erfahrungen',
  'reddit lexoffice sevdesk Alternative Handwerk',
  'Forum Handwerkersoftware Empfehlung gesucht',
  'Forum E-Rechnung Pflicht Handwerker welches Programm',
  'gutefrage Rechnungsprogramm Handwerker',
  'gutefrage Zeiterfassung App Mitarbeiter',
  'haustechnikdialog Forum Software Rechnung',
  'computerbase Forum Rechnungssoftware Handwerker',
  'woodworking Forum Software Tischlerei',
  'DATEV Community Zeiterfassung App',
  'Forum Malerbetrieb Software',
  'Forum Dachdecker Software Aufmaß',
  'Forum Garten- und Landschaftsbau Software Rechnung',
  'Forum Existenzgründung Handwerk Software',
];

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
  /** ISO-Zeitpunkt, zu dem der Lauf den Beitrag gefunden hat */
  gefundenAm: string;
}

type PushAbo = webpush.PushSubscription;

/** Spiegelt `GesucheZustand` in src/types (ohne `gesehen` und Push-Schlüssel). */
interface Zustand {
  einstellungen: { email: string; suchanfragen: string[]; tage: number };
  /** URL → Datum, an dem sie erstmals bewertet wurde. Verhindert Doppelmeldungen. */
  gesehen: Record<string, string>;
  treffer: GesuchTreffer[];
  pushAbos: PushAbo[];
  letzterLauf: { am: string; neueUrls: number; neueTreffer: number } | null;
}

const LEERER_ZUSTAND: Zustand = {
  einstellungen: { email: '', suchanfragen: STANDARD_SUCHANFRAGEN, tage: 90 },
  gesehen: {},
  treffer: [],
  pushAbos: [],
  letzterLauf: null,
};

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
 * Bekannte Reddit-Beiträge (ID → Datum). Die Vergaberate schwankt, deshalb mehrere Stützpunkte;
 * ein neuer, aktueller Eintrag hält die Hochrechnung für frische Beiträge genau.
 */
const REDDIT_STUETZPUNKTE = (
  [
    ['1h1dmwh', '2024-11-27'],
    ['1i2a1dx', '2025-01-15'],
    ['1pzcdab', '2025-12-30'],
    ['1x1uso9', '2026-10-10'],
    ['1xg8l9g', '2026-10-29'],
  ] as const
).map(([id, datum]) => ({ n: parseInt(id, 36), t: Date.parse(datum) }));

/**
 * Reddit-Beitrags-IDs (Base36) steigen fortlaufend. Abschnittsweise linear zwischen bekannten
 * Beiträgen hochgerechnet lag das Datum im Test 2–7 Tage daneben — genug für den Zeitfilter.
 */
function datumAusRedditId(url: string): string {
  const id = url.match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i)?.[1];
  if (!id) return '';
  const n = parseInt(id, 36);
  const p = REDDIT_STUETZPUNKTE;
  // Abschnitt, in dem n liegt; davor/danach mit dem ersten bzw. letzten Abschnitt weiterrechnen.
  const i = p.findIndex(x => x.n >= n);
  const k = i === -1 ? p.length - 1 : Math.max(i, 1);
  const [a, b] = [p[k - 1], p[k]];
  const t = a.t + ((n - a.n) * (b.t - a.t)) / (b.n - a.n);
  return new Date(Math.min(t, Date.now())).toISOString().slice(0, 10);
}

const MONATE: Record<string, number> = {
  jan: 0, feb: 1, mär: 2, mar: 2, apr: 3, mai: 4, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, dez: 11, dec: 11,
};
const TAGE_PRO_EINHEIT: [RegExp, number][] = [
  [/^(min|std|stunde|hour)/, 0],
  [/^(tag|day)/, 1],
  [/^(woche|week)/, 7],
  [/^(monat|month)/, 30],
  [/^(jahr|year)/, 365],
];

/** Datumsangabe, wie sie auf einer Seite steht („17.03.2026“, „vor 14 Jahren“, „Jan 15, 2025“) → YYYY-MM-DD. */
function datumAusText(roh: string): string {
  const s = roh.toLowerCase().replace(/[^\p{L}\p{N}.\-:, ]/gu, ' ').trim();
  const iso = (d: Date) => (Number.isNaN(d.getTime()) || d.getTime() > Date.now() ? '' : d.toISOString().slice(0, 10));

  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return iso(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
  m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return iso(new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])));
  m = s.match(/(\d{1,2})\.? ([a-zä]{3})[a-zä]* (\d{4})/) ?? s.match(/([a-zä]{3})[a-zä]* (\d{1,2}),? (\d{4})/);
  if (m) {
    const [tag, monat] = /^\d/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]];
    if (monat in MONATE) return iso(new Date(Date.UTC(+m[3], MONATE[monat], tag)));
  }
  if (/gestern|yesterday/.test(s)) return iso(new Date(Date.now() - 86_400_000));
  if (/heute|today|gerade|just now/.test(s)) return iso(new Date());
  m = s.match(/vor (\d+|einer?m?|einem) ([a-z]+)/) ?? s.match(/(\d+|an?) ([a-z]+) ago/);
  if (m) {
    const anzahl = /^\d+$/.test(m[1]) ? +m[1] : 1;
    const tage = TAGE_PRO_EINHEIT.find(([re]) => re.test(m![2]))?.[1];
    if (tage !== undefined) return iso(new Date(Date.now() - anzahl * tage * 86_400_000));
  }
  return '';
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
        const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
        ergebnis.set(url, { text, datum: datumAusHtml(await page.content()) });
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
 * Die angehängte Jahreszahl holt frische Beiträge nach oben: im Test 7 von 20 Reddit-Treffern
 * jünger als 30 Tage statt 1 von 23.
 */
async function sucheKandidaten(suchanfragen: string[], key: string): Promise<string[]> {
  const jahr = new Date().getFullYear();
  const proAnfrage = await Promise.all(
    suchanfragen.map(async anfrage => {
      try {
        const { quellen } = await gemini(
          {
            contents: [{ parts: [{ text: `Führe genau diese Google-Suche aus: ${anfrage} ${jahr}\nFasse die Treffer kurz zusammen.` }] }],
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
  // Reihum aus jeder Anfrage nehmen, damit eine spätere Obergrenze nicht nur die erste Anfrage trifft.
  const eindeutig = new Set<string>();
  for (let i = 0; i < Math.max(0, ...proAnfrage.map(l => l.length)); i++) {
    for (const liste of proAnfrage) if (liste[i] && istDiskussion(liste[i])) eindeutig.add(liste[i]);
  }
  return [...eindeutig];
}

/**
 * Nur Seiten, auf denen Menschen schreiben und man antworten kann. Anbieter-Blogs,
 * Vergleiche und Bewertungsportale fallen weg, bevor sie Gemini-Aufrufe kosten.
 * `?tl=` sind von Reddit maschinell übersetzte fremdsprachige Threads.
 */
function istDiskussion(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.searchParams.has('tl')) return false;
    if (/(^|\.)reddit\.com$/.test(u.hostname)) return /\/r\/[^/]+\/comments\//.test(u.pathname);
    if (/(^|\.)gutefrage\.net$/.test(u.hostname)) return u.pathname.startsWith('/frage/');
    return (
      /^(forum|foren|community|board)\./.test(u.hostname) ||
      /\/(forum|foren|threads?|topic|viewtopic|t5|community|diskussion|fragen?)[/._-]/i.test(u.pathname + '/')
    );
  } catch {
    return false;
  }
}

/**
 * Gesperrte Seiten über Geminis URL-Kontext lesen: Google ruft die Seite selbst ab.
 * Reddit sperrt sowohl Vercel als auch Browserbase (ohne bezahlte Proxys), Google nicht.
 * Wörtliche Wiedergabe verweigert Gemini (RECITATION), daher Zusammenfassung.
 */
async function leseMitGemini(url: string, key: string): Promise<{ text: string; datum: string } | null> {
  try {
    const { text } = await gemini(
      {
        contents: [{ parts: [{ text: `Rufe diese Seite ab: ${url}
Fasse in eigenen Worten zusammen: Titel, was die Person sucht oder kritisiert und was bisher geantwortet wurde.
Gib außerdem das Veröffentlichungsdatum des Eingangsbeitrags genau so an, wie es auf der Seite steht (z. B. "17.03.2026" oder "vor 14 Jahren"), sonst "".
Antworte nur mit JSON: {"titel":"","inhalt":"","datumAufSeite":""}` }] }],
        tools: [{ url_context: {} }],
        // Ohne Denkphase kam im Test bei 8 von 8 Aufrufen eine leere Antwort.
        generationConfig: { temperature: 0.2, thinkingConfig: { thinkingBudget: 512 } },
      },
      key,
      30_000,
    );
    const s = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as {
      titel?: string;
      inhalt?: string;
      datumAufSeite?: string;
    };
    if (!s.inhalt) return null;
    // Gemini liest das Datum zuverlässig ab, rechnet „vor 2 Jahren“ aber falsch um — das macht der Code.
    const datum = datumAusRedditId(url) || datumAusText(s.datumAufSeite ?? '');
    return { text: `${s.titel ?? ''}\n${s.inhalt}`, datum };
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
    return s ? [{ url, text: s.text.slice(0, MAX_SEITENTEXT), datum: s.datum }] : [];
  });
}

async function bewerte(seiten: GeladeneSeite[], tage: number, key: string): Promise<Omit<GesuchTreffer, 'gefundenAm'>[]> {
  const heute = new Date().toISOString().slice(0, 10);
  const prompt = `Heute ist ${heute}. Du hilfst einem Anbieter, im Netz Menschen zu finden, die gerade aktiv nach einer Lösung suchen.

Angebot des Anbieters: ${PRODUKT}

Unten stehen geladene Seiten. Bewerte jede:
- "relevant": true nur, wenn dort eine Person oder ein Betrieb aus dem deutschsprachigen Raum selbst nach passender Software fragt, sucht oder mit der bisherigen unzufrieden ist. Anbieterseiten, Ratgeber, Vergleichsportale ohne konkrete Nutzerbeiträge, Werbung, Beiträge von Anbietern selbst → false.
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
    throw new Error('Die KI-Bewertung war kein gültiges JSON.');
  }

  const grenze = Date.now() - tage * 86_400_000;
  return bewertungen
    .flatMap(b => {
      const o = b as Record<string, unknown>;
      const seite = seiten[Number(o.index)];
      if (!seite || o.relevant !== true) return [];
      // Ohne Datum lässt sich nicht prüfen, ob noch Interesse besteht (Test: 14 Jahre alter Thread rutschte durch).
      if (!seite.datum || new Date(seite.datum).getTime() < grenze) return [];
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

// ─── Zustand im Blob ─────────────────────────────────────────────────────────

async function ladeZustand(): Promise<{ zustand: Zustand; etag?: string }> {
  const r = await get(ZUSTAND_PFAD, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return { zustand: structuredClone(LEERER_ZUSTAND) };
  const gelesen = (await new Response(r.stream).json()) as Partial<Zustand>;
  return {
    zustand: {
      ...LEERER_ZUSTAND,
      ...gelesen,
      einstellungen: { ...LEERER_ZUSTAND.einstellungen, ...gelesen.einstellungen },
    },
    // Ab ein paar KB liefert get() ein schwaches ETag (W/"…", komprimiert); put({ ifMatch }) braucht das starke.
    etag: r.blob.etag.replace(/^W\//, ''),
  };
}

/** Lesen, ändern, schreiben. Schreibt jemand dazwischen (ETag passt nicht), neu versuchen. */
async function aendereZustand(aendern: (z: Zustand) => void): Promise<Zustand> {
  for (let versuch = 1; ; versuch++) {
    const { zustand, etag } = await ladeZustand();
    aendern(zustand);
    try {
      await put(ZUSTAND_PFAD, JSON.stringify(zustand), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        ...(etag ? { ifMatch: etag } : {}),
      });
      return zustand;
    } catch (e) {
      if (versuch >= 3) throw e;
    }
  }
}

/** Was die App sehen darf: ohne gesehene URLs und ohne Push-Schlüssel. */
function fuerApp(z: Zustand) {
  return {
    einstellungen: z.einstellungen,
    treffer: z.treffer,
    letzterLauf: z.letzterLauf,
    pushGeraete: z.pushAbos.length,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  };
}

// ─── Lauf und Benachrichtigung ───────────────────────────────────────────────

async function lauf(key: string): Promise<{ neueUrls: number; treffer: GesuchTreffer[]; zustand: Zustand }> {
  const { zustand } = await ladeZustand();
  const { suchanfragen, tage } = zustand.einstellungen;
  const neu = (await sucheKandidaten(suchanfragen, key)).filter(u => !zustand.gesehen[u]).slice(0, MAX_NEU_PRO_LAUF);
  const seiten = await ladeSeiten(neu, key);
  const jetzt = new Date().toISOString();
  const pakete = Array.from({ length: Math.ceil(seiten.length / SEITEN_PRO_BEWERTUNG) }, (_, i) =>
    seiten.slice(i * SEITEN_PRO_BEWERTUNG, (i + 1) * SEITEN_PRO_BEWERTUNG),
  );
  const treffer = (await Promise.all(pakete.map(p => bewerte(p, tage, key))))
    .flat()
    .filter(t => t.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .map(t => ({ ...t, gefundenAm: jetzt }));

  // Nur geladene Seiten gelten als gesehen; nicht ladbare werden beim nächsten Lauf erneut versucht.
  const gespeichert = await aendereZustand(z => {
    const grenze = Date.now() - GESEHEN_TAGE * 86_400_000;
    for (const [url, am] of Object.entries(z.gesehen)) if (Date.parse(am) < grenze) delete z.gesehen[url];
    for (const s of seiten) z.gesehen[s.url] = jetzt;
    const bekannt = new Set(z.treffer.map(t => t.url));
    z.treffer = [...treffer.filter(t => !bekannt.has(t.url)), ...z.treffer].slice(0, MAX_GESPEICHERTE_TREFFER);
    z.letzterLauf = { am: jetzt, neueUrls: neu.length, neueTreffer: treffer.length };
  });

  if (treffer.length) {
    const ergebnisse = await Promise.allSettled([
      sendeEmail(gespeichert.einstellungen.email, treffer),
      benachrichtigeGeraete(treffer),
    ]);
    for (const e of ergebnisse) if (e.status === 'rejected') console.error('api/gesuche Benachrichtigung:', e.reason);
  }
  return { neueUrls: neu.length, treffer, zustand: gespeichert };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function ueberschrift(anzahl: number): string {
  return anzahl === 1 ? '1 neues Gesuch im Netz' : `${anzahl} neue Gesuche im Netz`;
}

async function sendeEmail(an: string, treffer: GesuchTreffer[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const von = process.env.RESEND_FROM_EMAIL?.trim();
  if (!an || !apiKey || !von) return;
  const karten = treffer
    .map(
      t => `<div style="border:1px solid #ddd;border-radius:8px;padding:12px;margin:12px 0">
  <a href="${esc(t.url)}" style="font-weight:600">${esc(t.titel)}</a>
  <div style="color:#666;font-size:13px">${esc(t.quelle)} · ${esc(t.datum)} · Score ${t.score}</div>
  <p>${esc(t.zusammenfassung)}</p>
  <p style="background:#f5f5f5;padding:8px;border-radius:6px;white-space:pre-line"><b>Antwortvorschlag:</b><br>${esc(t.antwortVorschlag)}</p>
</div>`,
    )
    .join('');
  const html = `<div style="font-family:system-ui,sans-serif;max-width:640px"><h2>${ueberschrift(treffer.length)}</h2>${karten}
<p style="color:#666;font-size:13px">Alle Treffer: Akquise → Gesuche im Netz in der SØRGEL-App.</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: von, to: [an], subject: `${ueberschrift(treffer.length)}: ${treffer[0].titel}`, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

/** Push an alle registrierten Geräte; abgelaufene Abos (404/410) werden entfernt. */
async function benachrichtigeGeraete(treffer: GesuchTreffer[] | 'test'): Promise<number> {
  const { zustand } = await ladeZustand();
  if (zustand.pushAbos.length === 0) return 0;
  webpush.setVapidDetails(
    `mailto:${process.env.GESUCHE_INHABER_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? '',
  );
  const nachricht =
    treffer === 'test'
      ? { titel: 'Gesuche im Netz', text: 'Test: Benachrichtigungen funktionieren.', url: '/akquise?ansicht=gesuche' }
      : { titel: ueberschrift(treffer.length), text: treffer[0].titel, url: '/akquise?ansicht=gesuche' };
  const tot: string[] = [];
  let zugestellt = 0;
  await Promise.all(
    zustand.pushAbos.map(abo =>
      webpush
        .sendNotification(abo, JSON.stringify(nachricht), { TTL: 86_400 })
        .then(() => { zugestellt++; })
        .catch((e: { statusCode?: number }) => {
          if (e.statusCode === 404 || e.statusCode === 410) tot.push(abo.endpoint);
          else console.error('api/gesuche Push:', e);
        }),
    ),
  );
  if (tot.length) await aendereZustand(z => { z.pushAbos = z.pushAbos.filter(a => !tot.includes(a.endpoint)); });
  return zugestellt;
}

// ─── Zugriff ─────────────────────────────────────────────────────────────────

/** Firebase-ID-Token prüfen (Google validiert Signatur und Ablauf) und mit dem Inhaber vergleichen. */
async function istInhaber(req: VercelRequest): Promise<boolean> {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const inhaber = process.env.GESUCHE_INHABER_EMAIL?.trim().toLowerCase();
  if (!token || !apiKey || !inhaber) return false;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  });
  if (!r.ok) return false;
  const nutzer = ((await r.json()) as { users?: { email?: string; emailVerified?: boolean }[] }).users?.[0];
  return nutzer?.emailVerified === true && nutzer.email?.toLowerCase() === inhaber;
}

function istPushAbo(x: unknown): x is PushAbo {
  const a = x as PushAbo | null;
  return (
    !!a &&
    typeof a.endpoint === 'string' &&
    a.endpoint.startsWith('https://') &&
    typeof a.keys?.p256dh === 'string' &&
    typeof a.keys?.auth === 'string'
  );
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

  try {
    if (req.method === 'GET' && req.query.lauf === 'cron') {
      const geheim = process.env.CRON_SECRET;
      if (!geheim || req.headers.authorization !== `Bearer ${geheim}`) return res.status(401).json({ error: 'Nicht erlaubt' });
      const e = await lauf(key);
      return res.status(200).json({ neueUrls: e.neueUrls, neueTreffer: e.treffer.length });
    }

    if (!(await istInhaber(req))) return res.status(403).json({ error: 'Nur für den Inhaber freigegeben' });

    if (req.method === 'GET') return res.status(200).json(fuerApp((await ladeZustand()).zustand));
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = (typeof req.body === 'object' && req.body) || {};
    switch (body.aktion) {
      case 'einstellungen': {
        const email = String(body.email ?? '').trim();
        const suchanfragen = (Array.isArray(body.suchanfragen) ? body.suchanfragen : [])
          .map((s: unknown) => String(s).trim())
          .filter(Boolean)
          .slice(0, MAX_SUCHANFRAGEN);
        const tage = Number(body.tage);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
        if (suchanfragen.length === 0) return res.status(400).json({ error: 'Mindestens eine Suchanfrage angeben' });
        if (![7, 30, 90, 365].includes(tage)) return res.status(400).json({ error: 'Ungültiger Zeitraum' });
        const z = await aendereZustand(z => { z.einstellungen = { email, suchanfragen, tage }; });
        return res.status(200).json(fuerApp(z));
      }
      case 'lauf': {
        const e = await lauf(key);
        return res.status(200).json({ ...fuerApp(e.zustand), neueUrls: e.neueUrls, neueTreffer: e.treffer.length });
      }
      case 'push-abo': {
        if (!istPushAbo(body.abo)) return res.status(400).json({ error: 'Ungültiges Push-Abo' });
        const abo = body.abo;
        const z = await aendereZustand(z => { z.pushAbos = [...z.pushAbos.filter(a => a.endpoint !== abo.endpoint), abo]; });
        return res.status(200).json(fuerApp(z));
      }
      case 'push-test':
        return res.status(200).json({ zugestellt: await benachrichtigeGeraete('test') });
      case 'treffer-entfernen': {
        const url = String(body.url ?? '');
        const z = await aendereZustand(z => { z.treffer = z.treffer.filter(t => t.url !== url); });
        return res.status(200).json(fuerApp(z));
      }
      default:
        return res.status(400).json({ error: 'Unbekannte Aktion' });
    }
  } catch (err) {
    console.error('api/gesuche:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
