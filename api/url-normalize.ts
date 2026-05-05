/**
 * Normalisiert Website-Strings (Google Places liefert teils nur Hostnamen oder Sonderfälle).
 * Gibt null zurück, wenn keine gültige http(s)-URL gebaut werden kann — dann kein fetch, keine Syntaxfehler.
 */
export function normalisiereWebsiteUrl(roh: string): string | null {
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

export function basisAusUrl(absUrl: string): string | null {
  try {
    const u = new URL(absUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}
