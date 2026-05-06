/**
 * Nur HTTP-Fetch — kein Playwright, keine schweren Bundles.
 * Wird von api/analyse.ts immer verwendet; Browserbase optional separat.
 */

function htmlZuKlartext(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

export type FetchMethod = 'browserbase' | 'http';

export interface GeladeneSeiten {
  startseite: string;
  impressum: string;
  methode: FetchMethod;
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

/** Nur HTTP — stabil auf Vercel Serverless. */
export async function ladeSeiteninhalteHttp(params: {
  hauptUrl: string;
  impressumKandidaten: string[];
}): Promise<GeladeneSeiten> {
  return ladePerHttp(params.hauptUrl, params.impressumKandidaten);
}
