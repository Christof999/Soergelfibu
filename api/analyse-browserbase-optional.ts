/**
 * Nur Browserbase + Playwright (optional). Wird von api/analyse.ts per dynamischem import geladen.
 */

import type { FetchMethod, GeladeneSeiten } from './analyse-fetch-lite';
import { fetchSeiteHttp } from './analyse-fetch-lite';

async function extrahiereSichtbarText(page: { evaluate: (fn: () => string) => Promise<string> }): Promise<string> {
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

async function gotoUndText(
  page: {
    goto: (url: string, opts: object) => Promise<unknown>;
    evaluate: (fn: () => string) => Promise<string>;
  },
  url: string,
  timeoutMs: number,
): Promise<string> {
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

/** Nur aufrufen wenn BROWSERBASE_API_KEY gesetzt — sonst null */
export async function ladeMitBrowserbase(params: {
  hauptUrl: string;
  impressumKandidaten: string[];
}): Promise<GeladeneSeiten | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) return null;

  let browser: { close: () => Promise<unknown> } | undefined;

  try {
    const [{ default: Browserbase }, { chromium }] = await Promise.all([
      import('@browserbasehq/sdk'),
      import('playwright-core'),
    ]);

    const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
    const bb = new Browserbase({ apiKey });

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

    const { hauptUrl, impressumKandidaten } = params;

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
      methode: 'browserbase' as FetchMethod,
    };
  } catch (e) {
    console.error('Browserbase:', e);
    await browser?.close().catch(() => {});
    return null;
  }
}
