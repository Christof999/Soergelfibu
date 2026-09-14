import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Alles in einer Datei: weniger Bundling-Probleme auf Vercel. */

/** Große HTML-Seiten sonst OOM / Regex auf MB-Strings → FUNCTION_INVOCATION_FAILED auf Vercel. */
const MAX_HTML_RAW_CHARS = 450_000;
/** Hartes Byte-Limit beim Einlesen: verhindert OOM durch `res.text()` bei MB-HTML (parallel bis zu 7 Requests). */
const MAX_HTML_READ_BYTES = 900_000;

/**
 * Statt `res.text()` (lädt immer den kompletten Body): nur bis zu maxChars / maxBytes einlesen und Stream abbrechen.
 */
async function readResponseTextLimited(res: Response, maxChars: number, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const decoder = new TextDecoder('utf-8');
  const reader = res.body.getReader();
  let acc = '';
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      totalBytes += value.length;
      acc += decoder.decode(value, { stream: true });
      if (acc.length >= maxChars || totalBytes >= maxBytes) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  } catch {
    /* Netzwerkabbruch o. Ä. */
  }
  acc += decoder.decode();
  return acc.slice(0, maxChars);
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body as unknown;
  if (b == null) return {};
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(b)) {
    try {
      const j = JSON.parse(b.toString('utf8')) as unknown;
      return typeof j === 'object' && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
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
  const raw = html.length > MAX_HTML_RAW_CHARS ? html.slice(0, MAX_HTML_RAW_CHARS) : html;
  try {
    return raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

/** Offensichtlich technische / Fremd-/Platzhalter-Adressen, die kein echter Kontakt sind. */
const EMAIL_AUSSCHLUSS = [
  'sentry', 'wixpress', 'example.', '@example', 'your-email', 'yourname', 'youremail',
  'domain.com', 'domain.de', 'mustermann', 'muster@', 'test@test', 'email@example', 'name@',
  'godaddy', 'cloudflare', 'jsdelivr', 'wordpress', 'cookiebot', 'borlabs', 'wp.com',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.css', '.js', '.webmanifest',
];

/** Häufige Postfach-Präfixe eines Erstkontakts – nach Relevanz für die Auswahl der besten Adresse. */
const EMAIL_PREFIX_RANG = [
  'info', 'kontakt', 'mail', 'office', 'buero', 'hallo', 'anfrage', 'service',
  'kanzlei', 'praxis', 'post', 'sekretariat', 'empfang',
];

function bereinigeEmail(roh: string): string | null {
  let e = roh.trim().replace(/^mailto:/i, '');
  e = e.split('?')[0]; // ?subject=… etc. abschneiden
  e = e.replace(/^[<("'\s]+/, '').replace(/[>)"'\s.,;:]+$/, '');
  e = e.replace(/\s+/g, '').toLowerCase();
  if (e.length > 80) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return null;
  for (const bad of EMAIL_AUSSCHLUSS) if (e.includes(bad)) return null;
  return e;
}

/** Konservative De-Verschleierung: nur Klammer-/Wort-Varianten wie "info (at) firma (dot) de". */
function deobfuskiere(html: string): string {
  return html
    .replace(/\s*[[({]\s*(?:at|ät)\s*[\])}]\s*/gi, '@')
    .replace(/\s*[[({]\s*(?:dot|punkt)\s*[\])}]\s*/gi, '.');
}

/** Findet E-Mail-Adressen im ROH-HTML (inkl. mailto-Links und einfacher Verschleierung). */
function extrahiereEmails(html: string): string[] {
  if (!html) return [];
  const quelle = html.length > MAX_HTML_RAW_CHARS ? html.slice(0, MAX_HTML_RAW_CHARS) : html;
  const treffer = new Set<string>();
  // 1) mailto:-Links (greifen auch, wenn der sichtbare Text keine Adresse zeigt)
  for (const m of quelle.matchAll(/mailto:([^"'>?\s]+)/gi)) {
    const e = bereinigeEmail(m[1]);
    if (e) treffer.add(e);
  }
  // 2) Klartext-Adressen, inkl. einfach verschleierter Schreibweisen
  const text = deobfuskiere(quelle);
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    const e = bereinigeEmail(m[0]);
    if (e) treffer.add(e);
  }
  return [...treffer];
}

/** Wählt die plausibelste Kontakt-Adresse: Domain-Treffer und Postfach-Präfix gewichten. */
function waehleBesteEmail(emails: string[], siteHost: string | null): string {
  if (emails.length === 0) return '';
  const host = (siteHost ?? '').replace(/^www\./i, '').toLowerCase();
  const score = (e: string): number => {
    const [prefix = '', domain = ''] = e.split('@');
    let s = 0;
    if (host && (domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`))) s += 100;
    const rang = EMAIL_PREFIX_RANG.indexOf(prefix);
    if (rang >= 0) s += 40 - rang * 2;
    if (/^(noreply|no-reply|newsletter|abuse|postmaster|privacy|datenschutz)/.test(prefix)) s -= 30;
    if (/(sentry|wix|wordpress|jimdo|google|gstatic)/.test(domain)) s -= 20;
    return s;
  };
  return [...emails].sort((a, b) => score(b) - score(a))[0];
}

async function fetchSeiteHttp(url: string, timeoutMs = 6500): Promise<{ text: string; emails: string[] }> {
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
    if (!res.ok) return { text: '', emails: [] };
    const html = await readResponseTextLimited(res, MAX_HTML_RAW_CHARS, MAX_HTML_READ_BYTES);
    return { text: htmlZuKlartext(html), emails: extrahiereEmails(html) };
  } catch {
    return { text: '', emails: [] };
  } finally {
    clearTimeout(timer);
  }
}

async function ladeSeitenParallel(hauptUrl: string, impressumKandidaten: string[]) {
  try {
    const MAX_IMPRESSUM = 6;
    const urls = [hauptUrl, ...impressumKandidaten.slice(0, MAX_IMPRESSUM)];
    const seiten = await Promise.all(urls.map(u => fetchSeiteHttp(u, 6500)));
    const startseite = (seiten[0]?.text ?? '').slice(0, 4500);
    let impressum = '';
    for (let i = 1; i < seiten.length; i++) {
      if (seiten[i].text.length > 100) {
        impressum = seiten[i].text;
        break;
      }
    }
    // Impressum-/Kontakt-Treffer zuerst (verlässlicher), dann Startseite
    const emails = new Set<string>();
    for (let i = 1; i < seiten.length; i++) seiten[i].emails.forEach(e => emails.add(e));
    seiten[0]?.emails.forEach(e => emails.add(e));
    return {
      startseite,
      impressum: impressum.slice(0, 2200),
      emails: [...emails],
    };
  } catch (e) {
    console.error('ladeSeitenParallel:', e);
    return { startseite: '', impressum: '', emails: [] as string[] };
  }
}

/**
 * Startseite mit Browserbase + Playwright (JS ausgeführt). Nur wenn Env gesetzt.
 * Vercel: BROWSERBASE_API_KEY (optional BROWSERBASE_PROJECT_ID).
 */
async function fetchSeiteBrowserbase(
  url: string,
  extraEmailUrls: string[] = []
): Promise<{ text: string; emails: string[] }> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) return { text: '', emails: [] };
  try {
    const { default: Browserbase } = await import('@browserbasehq/sdk');
    const { chromium } = await import('playwright-core');
    const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
    const bb = new Browserbase({ apiKey });
    const session = await bb.sessions.create({
      timeout: 50,
      region: 'eu-central-1',
      ...(projectId ? { projectId } : {}),
    });
    const connectUrl = session.connectUrl;
    if (!connectUrl) return { text: '', emails: [] };

    const browser = await chromium.connectOverCDP(connectUrl);
    try {
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 22000 });
      await new Promise<void>(resolve => setTimeout(resolve, 1200));
      let html = await page.content();
      if (html.length > MAX_HTML_RAW_CHARS) html = html.slice(0, MAX_HTML_RAW_CHARS);
      const emails = new Set(extrahiereEmails(html));
      const text = htmlZuKlartext(html);
      if (emails.size === 0) {
        for (const u of extraEmailUrls.slice(0, 3)) {
          try {
            await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 18000 });
            await new Promise<void>(resolve => setTimeout(resolve, 800));
            let extra = await page.content();
            if (extra.length > MAX_HTML_RAW_CHARS) extra = extra.slice(0, MAX_HTML_RAW_CHARS);
            extrahiereEmails(extra).forEach(e => emails.add(e));
            if (emails.size > 0) break;
          } catch {
            /* nächste URL */
          }
        }
      }
      return { text, emails: [...emails] };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e) {
    console.error('fetchSeiteBrowserbase:', e);
    return { text: '', emails: [] };
  }
}

/**
 * Letzter Ausweg für die Kontakt-E-Mail: Impressum/Kontakt im echten Browser laden
 * (eine Session, mehrere Seiten nacheinander) — fängt JS-gerenderte oder Bot-geschützte Seiten ab.
 */
async function fetchEmailsBrowserbase(urls: string[]): Promise<string[]> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey || urls.length === 0) return [];
  try {
    const { default: Browserbase } = await import('@browserbasehq/sdk');
    const { chromium } = await import('playwright-core');
    const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
    const bb = new Browserbase({ apiKey });
    const session = await bb.sessions.create({
      timeout: 50,
      region: 'eu-central-1',
      ...(projectId ? { projectId } : {}),
    });
    const connectUrl = session.connectUrl;
    if (!connectUrl) return [];

    const browser = await chromium.connectOverCDP(connectUrl);
    try {
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());
      const gefunden = new Set<string>();
      for (const u of urls.slice(0, 3)) {
        try {
          await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 18000 });
          await new Promise<void>(resolve => setTimeout(resolve, 800));
          let html = await page.content();
          if (html.length > MAX_HTML_RAW_CHARS) html = html.slice(0, MAX_HTML_RAW_CHARS);
          extrahiereEmails(html).forEach(e => gefunden.add(e));
          if (gefunden.size > 0) break;
        } catch {
          /* nächste URL versuchen */
        }
      }
      return [...gefunden];
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e) {
    console.error('fetchEmailsBrowserbase:', e);
    return [];
  }
}

interface GeminiParsed {
  optimierungen?: unknown[];
  seoOptimierungen?: unknown[];
  ansprechpartner?: string;
  zusammenfassung?: string;
  websiteGeladen?: boolean;
}

/** Entfernt ```json … ``` um Gemini-Rohausgaben zu parsen. */
function stripMarkdownCodeFence(text: string): string {
  let t = text.trim();
  if (!t.startsWith('```')) return t;
  t = t.replace(/^```(?:json)?\s*\n?/i, '');
  const end = t.lastIndexOf('```');
  if (end >= 0) t = t.slice(0, end);
  return t.trim();
}

/** Erstes vollständiges JSON-Objekt per Klammerzählung (Strings mit " werden berücksichtigt). */
function extractFirstJSONObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (!inStr) {
      if (c === '"') {
        inStr = true;
        escaped = false;
      } else if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0) return raw.slice(start, i + 1);
      }
    } else if (escaped) {
      escaped = false;
    } else if (c === '\\') {
      escaped = true;
    } else if (c === '"') {
      inStr = false;
    }
  }
  return null;
}

/** Einfache Reparatur abgeschnittener JSON-Antworten (häufig bei zu kleinem maxOutputTokens). */
function tryRepairTruncatedJson(s: string): string | null {
  const t = s.trim();
  if (!t.startsWith('{') || t.length < 30) return null;
  const suffixes = ['}}', ']}', ']}}', '"]}}', '"}}}', '"}]}', '"}]}}'];
  for (const suf of suffixes) {
    try {
      JSON.parse(t + suf);
      return t + suf;
    } catch {
      /* nächster Versuch */
    }
  }
  return null;
}

function parseGeminiJson(rawText: string): GeminiParsed {
  const stripped = stripMarkdownCodeFence(rawText.trim()).slice(0, 120_000);
  try {
    return JSON.parse(stripped) as GeminiParsed;
  } catch {
    /* weiter unten */
  }
  const repaired = tryRepairTruncatedJson(stripped);
  if (repaired) {
    try {
      return JSON.parse(repaired) as GeminiParsed;
    } catch {
      /* weiter unten */
    }
  }
  const balanced = extractFirstJSONObject(stripped);
  if (balanced) {
    try {
      return JSON.parse(balanced) as GeminiParsed;
    } catch {
      /* weiter unten */
    }
  }
  const match = stripped.match(/\{[\s\S]*\}/);
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
    zusammenfassung:
      'Die KI-Antwort war unvollständig oder technisch nicht lesbar. Bitte „KI-Analyse“ erneut ausführen — bei hartnäckigen Fällen unterstützt ein zweiter Lauf mit Browser-Rendering (falls konfiguriert) automatisch.',
    websiteGeladen: false,
  };
}

/** Erkennt unbrauchbare / abgebrochene KI-Antworten (soll Browserbase+Retry auslösen). */
function geminiAntwortIstFallback(parsed: GeminiParsed): boolean {
  const z = String(parsed.zusammenfassung ?? '').trim();
  if (z.startsWith('{') && z.includes('"optimierungen"')) return true;
  const o = parsed.optimierungen;
  if (!Array.isArray(o) || o.length === 0) return true;
  for (const item of o) {
    if (typeof item === 'string' && item.trimStart().startsWith('{')) return true;
  }
  if (o.length === 1) {
    const x = o[0];
    const t = typeof x === 'string' ? x : JSON.stringify(x);
    if (t.includes('Analyse konnte nicht ausgewertet werden')) return true;
  }
  return false;
}

function buildAnalysePrompt(
  name: string,
  branche: string,
  website: string,
  hauptUrlNorm: string | null,
  hauptseite: string,
  impressum: string,
  kontextHerkunft: string,
  hatInhalt: boolean
): string {
  return `Du bist ein erfahrener SEO- und Webdesign-Spezialist UND denkst gleichzeitig aus Sicht eines typischen Webseitenbesuchers (Handwerk/B2B).

Unternehmen: ${name}
Branche: ${branche || 'Unbekannt'}
Website: ${hauptUrlNorm ?? (website.trim() || 'keine Website angegeben')}

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

ZUSÄTZLICHER SEO-KURZCHECK (genau 3 Punkte, bewusst knapp — es ist ein Erstkontakt):
- Stil nach „claude-seo“: jede Empfehlung evidenzbasiert und an Googles Primärquellen orientiert (Search Essentials, Search Quality Rater Guidelines, E-E-A-T) — keine SEO-Mythen, keine erfundenen Kennzahlen oder Rankings, keine Keyword-Dichte-Tricks.
- Prüfe nur, was aus dem gelieferten Seiteninhalt ableitbar ist, z. B.: aussagekräftiger Seitentitel / Meta-Beschreibung, klare Überschriftenstruktur (eine eindeutige H1), beschreibende Inhalte zum konkreten Angebot, lokale SEO-Signale (Name/Adresse/Telefon konsistent, Standortbezug), Vertrauenssignale (Impressum, Bewertungen), strukturierte Daten.
- Ist ein Signal nicht belegbar, formuliere die Empfehlung als prüfbaren nächsten Schritt („… sollte geprüft werden“), ohne zu behaupten, du hättest es gemessen.
- Jeder SEO-Punkt: kurzer Titel + 1–2 Sätze konkrete, umsetzbare Empfehlung. Die SEO-Punkte sollen sich von den drei Optimierungen oben unterscheiden (Fokus auf Auffindbarkeit bei Google, nicht Optik/Bedienung).

Antworte ausschließlich als ein einziges gültiges JSON-Objekt (kein Markdown, kein Text davor oder danach):
{
  "optimierungen": [
    { "titel": "Kurze Überschrift für Punkt 1", "empfehlung": "Konkrete Empfehlung als Fließtext." },
    { "titel": "…", "empfehlung": "…" },
    { "titel": "…", "empfehlung": "…" }
  ],
  "seoOptimierungen": [
    { "titel": "Kurzer SEO-Titel 1", "empfehlung": "Belegbare, an Google-Primärquellen orientierte SEO-Empfehlung (1–2 Sätze)." },
    { "titel": "…", "empfehlung": "…" },
    { "titel": "…", "empfehlung": "…" }
  ],
  "ansprechpartner": "Name aus Impressum oder leerer String",
  "zusammenfassung": "Was macht das Unternehmen und warum Lead-interessant (1-2 Sätze, nur Belegtes)",
  "websiteGeladen": ${hatInhalt}
}`;
}

async function rufeGeminiAuf(
  prompt: string,
  GEMINI_KEY: string,
  timeoutMs: number
): Promise<{ ok: boolean; rawText: string; status?: number; geminiData?: unknown }> {
  const geminiCtrl = new AbortController();
  const geminiTimer = setTimeout(() => geminiCtrl.abort(), timeoutMs);
  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        signal: geminiCtrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      }
    );
    let geminiData: unknown;
    try {
      geminiData = await geminiRes.json();
    } catch {
      return { ok: false, rawText: '{}' };
    }
    if (!geminiRes.ok) {
      return { ok: false, rawText: '{}', status: geminiRes.status, geminiData };
    }
    const g = geminiData as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = g.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    return { ok: true, rawText };
  } catch {
    return { ok: false, rawText: '{}' };
  } finally {
    clearTimeout(geminiTimer);
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
    const nurKontakt = body.nurKontakt === true;

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!nurKontakt && !GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });

    let hauptseite = '';
    let impressum = '';
    let fetchMethode: 'http' | 'browserbase' = 'http';
    let gefundeneEmails: string[] = [];
    let impressumKandidaten: string[] = [];
    const hauptUrlNorm = normalisiereWebsiteUrl(website);

    if (hauptUrlNorm) {
      const basis = basisAusUrl(hauptUrlNorm);
      if (basis) {
        impressumKandidaten = [
          `${basis}/impressum`,
          `${basis}/impressum.html`,
          `${basis}/impressum.php`,
          `${basis}/impressum/`,
          `${basis}/ueber-uns`,
          `${basis}/kontakt`,
          `${basis}/kontakt.html`,
          `${basis}/de/impressum`,
          `${basis}/legal/imprint`,
          `${basis}/imprint`,
        ];
        const geladen = await ladeSeitenParallel(hauptUrlNorm, impressumKandidaten);
        hauptseite = geladen.startseite;
        impressum = geladen.impressum;
        gefundeneEmails = geladen.emails;
      }
    }

    let hatInhalt = hauptseite.length > 50 || impressum.length > 50;
    /** HTTP oft nur Bot-Schutz/leere Shell → dann Browserbase versuchen */
    const startZuDuenn = hauptseite.trim().length < 120;
    const bbKey = process.env.BROWSERBASE_API_KEY?.trim();
    const brauchtBrowserInhalt = !!(bbKey && hauptUrlNorm && (!hatInhalt || startZuDuenn));
    const brauchtBrowserEmail = !!(bbKey && hauptUrlNorm && gefundeneEmails.length === 0);

    if (brauchtBrowserInhalt) {
      const bb = await fetchSeiteBrowserbase(
        hauptUrlNorm!,
        brauchtBrowserEmail ? impressumKandidaten : []
      );
      if (bb.text.length >= 40 && bb.text.length > hauptseite.length) {
        hauptseite = bb.text.slice(0, 4500);
        fetchMethode = 'browserbase';
      }
      if (bb.emails.length) gefundeneEmails = [...new Set([...gefundeneEmails, ...bb.emails])];
    } else if (brauchtBrowserEmail) {
      /** Impressum/Kontakt im echten Browser — bevor Gemini startet, sonst wird das auf Vercel oft abgeschnitten. */
      const bbEmails = await fetchEmailsBrowserbase([...impressumKandidaten, hauptUrlNorm!]);
      if (bbEmails.length) gefundeneEmails = bbEmails;
    }

    hatInhalt = hauptseite.length > 50 || impressum.length > 50;

    let siteHost: string | null = null;
    try {
      siteHost = hauptUrlNorm ? new URL(hauptUrlNorm).hostname : null;
    } catch {
      siteHost = null;
    }

    if (nurKontakt) {
      return res.status(200).json({
        kontaktEmail: waehleBesteEmail(gefundeneEmails, siteHost),
        websiteGeladen: hatInhalt,
        seitenabrufMethode: fetchMethode,
      });
    }

    let kontextHerkunft =
      fetchMethode === 'browserbase'
        ? 'Die Startseite wurde in einem echten Browser (Browserbase, JavaScript aktiv) geladen — näher an dem, was Besucher sehen, als ein reiner HTTP-Textabruf.'
        : 'Der Seiteninhalt wurde per HTTP abgerufen (ohne JavaScript; dynamische Inhalte können fehlen).';

    let prompt = buildAnalysePrompt(name, branche, website, hauptUrlNorm, hauptseite, impressum, kontextHerkunft, hatInhalt);

    let geminiOut = await rufeGeminiAuf(prompt, GEMINI_KEY!, 48_000);
    if (!geminiOut.ok) {
      if (geminiOut.status != null && geminiOut.geminiData != null) {
        const errMsg =
          typeof geminiOut.geminiData === 'object' &&
          geminiOut.geminiData !== null &&
          'error' in geminiOut.geminiData &&
          typeof (geminiOut.geminiData as { error?: { message?: string } }).error?.message === 'string'
            ? (geminiOut.geminiData as { error: { message: string } }).error.message
            : JSON.stringify(geminiOut.geminiData);
        return res.status(500).json({ error: `Gemini API Fehler: ${errMsg}` });
      }
      return res.status(504).json({
        error: 'Gemini-Anfrage fehlgeschlagen oder Zeitüberschreitung.',
      });
    }

    let parsed = parseGeminiJson(geminiOut.rawText);

    /** KI lieferte kein brauchbares JSON oder Fallback — einmal Browserbase + zweiter Gemini-Lauf (echtes Rendering). */
    if (geminiAntwortIstFallback(parsed) && bbKey && hauptUrlNorm && fetchMethode === 'http') {
      const bb = await fetchSeiteBrowserbase(
        hauptUrlNorm,
        gefundeneEmails.length === 0 ? impressumKandidaten : []
      );
      if (bb.emails.length) gefundeneEmails = [...new Set([...gefundeneEmails, ...bb.emails])];
      if (bb.text.length >= 80) {
        hauptseite = bb.text.slice(0, 4500);
        fetchMethode = 'browserbase';
        hatInhalt = hauptseite.length > 50 || impressum.length > 50;
        kontextHerkunft =
          'Die Startseite wurde in einem echten Browser (Browserbase, JavaScript aktiv) geladen — zweiter Versuch nach unbrauchbarer KI-Antwort beim reinen HTTP-Abruf.';
        prompt = buildAnalysePrompt(name, branche, website, hauptUrlNorm, hauptseite, impressum, kontextHerkunft, hatInhalt);
        geminiOut = await rufeGeminiAuf(prompt, GEMINI_KEY!, 48_000);
        if (geminiOut.ok) {
          parsed = parseGeminiJson(geminiOut.rawText);
        }
      }
    }

    const opts = optimierungenAusAntwort(Array.isArray(parsed.optimierungen) ? parsed.optimierungen : []);
    const seoOpts = optimierungenAusAntwort(Array.isArray(parsed.seoOptimierungen) ? parsed.seoOptimierungen : []);
    const kontaktEmail = waehleBesteEmail(gefundeneEmails, siteHost);

    return res.status(200).json({
      optimierungen: opts,
      seoOptimierungen: seoOpts,
      ansprechpartner: parsed.ansprechpartner ?? '',
      kontaktEmail,
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
