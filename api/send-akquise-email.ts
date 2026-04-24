import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Versand der Akquise-E-Mail über Resend.
 * Vercel: RESEND_API_KEY, RESEND_FROM_EMAIL (z. B. "Akquise <onboarding@resend.dev>" oder verifizierte Domain)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as { to?: string; subject?: string; html?: string; text?: string };
  const to = String(body?.to ?? '').trim();
  const subject = String(body?.subject ?? '').trim();
  const html = String(body?.html ?? '');
  const text = String(body?.text ?? '').trim() || undefined;

  if (!to || !to.includes('@')) {
    return res.status(400).json({ error: 'Ungültige Empfänger-Adresse' });
  }
  if (!subject) {
    return res.status(400).json({ error: 'Betreff fehlt' });
  }
  if (!html) {
    return res.status(400).json({ error: 'HTML-Inhalt fehlt' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey) {
    return res.status(500).json({
      error: 'RESEND_API_KEY ist nicht konfiguriert',
      hint: 'In Vercel unter Project → Settings → Environment Variables setzen und neu deployen.',
    });
  }
  if (!from) {
    return res.status(500).json({
      error: 'RESEND_FROM_EMAIL ist nicht konfiguriert',
      hint: 'Absender-Adresse in Vercel setzen (Domain bei Resend verifizieren).',
    });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(text ? { text } : {}),
      }),
    });

    const data = (await r.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };

    if (!r.ok) {
      const msg =
        typeof data?.message === 'string'
          ? data.message
          : JSON.stringify(data);
      return res.status(r.status >= 400 ? r.status : 502).json({
        error: `Resend: ${msg}`,
        hint:
          r.status === 403
            ? 'API-Key oder Absender-Berechtigung prüfen.'
            : undefined,
      });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: 'Versand fehlgeschlagen',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
