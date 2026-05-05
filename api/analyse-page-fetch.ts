/**
 * Seitenabruf für Akquise-KI: Browserbase (echter Browser) mit Fallback auf HTTP-fetch.
 */

import Browserbase from '@browserbasehq/sdk';
import { chromium, type Browser, type Page } from 'playwright-core';

function htmlZuKlartext(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Klassischer HTTP-Abruf (kein JS). */
export async function fetchSeiteHttp(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
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
    clearTimeout(t);
    if (!res.ok) return '';
    const html = await res.text();
    return htmlZuKlartext(html);
  } catch {
    clearTimeout(t);
    return '';
  }
}

async function extrahiereSichtbarText(page: Page): Promise<string> {
  return page.evaluate(() => {
    try {
      const body = document.body;
      if (!body) return '';
      return (body.innerText || '').replace(/\s+/g, ' ').trim();
    } catch {
      return '';
    }
  });
}

async function gotoUndText(page: Page, url: string, timeoutMs: number): Promise<string> {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  await new Promise(r => setTimeout(r, 1500));
  let text = await extrahiereSichtbarText(page);
  if (text.length < 80) {
    await new Promise(r => setTimeout(r, 2200));
    text = await extrahiereSichtbarText(page);
  }
  return text;
}

export type FetchMethod = 'browserbase' | 'http';

export interface GeladeneSeiten {
  startseite: string;
  impressum: string;
  methode: FetchMethod;
}

async function ladePerBrowserbase(hauptUrl: string, impressumKandidaten: string[]): Promise<GeladeneSeiten | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) return null;

  const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
  const bb = new Browserbase({ apiKey });
  let browser: Browser | undefined;

  try {
    const session = await bb.sessions.create({
      ...(projectId ? { projectId } : {}),
      timeout: 360,
    });
    const connectUrl = (session as { connectUrl?: string }).connectUrl;
    if (!connectUrl) {
      throw new Error('Browserbase: connectUrl fehlt in Session-Antwort');
    }

    browser = await chromium.connectOverCDP(connectUrl);
    const context =
      browser.contexts()[0] ??
      (await browser.newContext({
        locale: 'de-DE',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      }));
    const page = context.pages()[0] ?? (await context.newPage());

    let startseite = '';
    try {
      startseite = await gotoUndText(page, hauptUrl, 45000);
    } catch {
      startseite = '';
    }

    if (startseite.length < 120) {
      const httpFallback = await fetchSeiteHttp(hauptUrl, 12000);
      if (httpFallback.length > startseite.length) startseite = httpFallback;
    }

    let impressum = '';
    for (const url of impressumKandidaten) {
      try {
        const t = await gotoUndText(page, url, 35000);
        if (t.length > 100) {
          impressum = t;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!impressum) {
      for (const url of impressumKandidaten) {
        const t = await fetchSeiteHttp(url, 8000);
        if (t.length > 100) {
          impressum = t;
          break;
        }
      }
    }

    await browser.close().catch(() => {});
    browser = undefined;

    return {
      startseite: startseite.slice(0, 4500),
      impressum: impressum.slice(0, 2200),
      methode: 'browserbase',
    };
  } catch (e) {
    console.error('Browserbase:', e);
    await browser?.close().catch(() => {});
    return null;
  }
}

async function ladePerHttp(hauptUrl: string, impressumKandidaten: string[]): Promise<GeladeneSeiten> {
  const startseite = (await fetchSeiteHttp(hauptUrl, 12000)).slice(0, 4500);
  let impressum = '';
  for (const url of impressumKandidaten) {
    const t = await fetchSeiteHttp(url, 8000);
    if (t.length > 100) {
      impressum = t;
      break;
    }
  }
  return {
    startseite,
    impressum: impressum.slice(0, 2200),
    methode: 'http',
  };
}

/**
 * Startseite + erstes brauchbares Impressum.
 * Primär Browserbase (ein Browser, mehrere Navigations), sonst HTTP.
 */
export async function ladeSeiteninhalte(params: {
  hauptUrl: string;
  impressumKandidaten: string[];
}): Promise<GeladeneSeiten> {
  const bb = await ladePerBrowserbase(params.hauptUrl, params.impressumKandidaten);
  if (bb) {
    const bbHatSubstanz = bb.startseite.length > 50 || bb.impressum.length > 50;
    if (bbHatSubstanz) return bb;
    const http = await ladePerHttp(params.hauptUrl, params.impressumKandidaten);
    const httpBesser =
      http.startseite.length > bb.startseite.length || http.impressum.length > bb.impressum.length;
    return httpBesser ? http : bb;
  }
  return ladePerHttp(params.hauptUrl, params.impressumKandidaten);
}
