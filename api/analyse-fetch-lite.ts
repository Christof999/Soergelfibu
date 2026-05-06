/**
 * Nur HTTP-Fetch — kurze Timeouts + parallele Abrufe, damit die Funktion unter Vercel-Limits bleibt.
 * (Sequenzielle 7×8s Requests haben FUNCTION_INVOCATION_FAILED durch Timeout ausgelöst.)
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

export async function fetchSeiteHttp(url: string, timeoutMs = 6000): Promise<string> {
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

export type FetchMethod = 'browserbase' | 'http';

export interface GeladeneSeiten {
  startseite: string;
  impressum: string;
  methode: FetchMethod;
}

/**
 * Hauptseite + Impressum-Kandidaten parallel — typisch unter 7 s Wandzeit statt 60+ s seriell.
 */
export async function ladeSeiteninhalteHttp(params: {
  hauptUrl: string;
  impressumKandidaten: string[];
}): Promise<GeladeneSeiten> {
  const { hauptUrl, impressumKandidaten } = params;
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
    methode: 'http',
  };
}
