import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Versand der Akquise-E-Mail über Resend (https://resend.com).
 *
 * Umgebungsvariablen (Vercel → Project → Settings → Environment Variables):
 * - RESEND_API_KEY   (erforderlich)
 * - RESEND_FROM_EMAIL (erforderlich, z. B. "Akquise <hallo@deinedomain.de>" – Domain bei Resend verifizieren)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey) {
    return res.status(503).json({
      error: 'E-Mail-Versand ist nicht eingerichtet.',
      hint: 'Lege in Vercel die Umgebungsvariable RESEND_API_KEY an (Resend.com). Alternativ: „In Mail-App öffnen“ nutzen.',
      code: 'MISSING_RESEND_KEY',
    });
  }

  if (!from) {
    return res.status(503).json({
      error: 'Absender-Adresse fehlt.',
      hint: 'Setze RESEND_FROM_EMAIL in Vercel (z. B. "Name <mail@verifizierte-domain.de>").',
      code: 'MISSING_FROM',
    });
  }

  const body = req.body as {
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
  };

  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body.html === 'string' ? body.html : '';
  const text = typeof body.text === 'string' ? body.text : undefined;

  if (!to || !to.includes('@')) {
    return res.status(400).json({ error: 'Gültige Empfänger-Adresse (to) erforderlich.' });
  }
  if (!subject) {
    return res.status(400).json({ error: 'Betreff (subject) erforderlich.' });
  }
  if (!html || html.length < 20) {
    return res.status(400).json({ error: 'HTML-Inhalt erforderlich.' });
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

    const data = (await r.json()) as { id?: string; message?: string; name?: string };

    if (!r.ok) {
      const msg = data?.message ?? data?.name ?? JSON.stringify(data);
      return res.status(502).json({
        error: `Versand fehlgeschlagen: ${msg}`,
        detail: data,
      });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Netzwerkfehler beim Versand.', detail: String(e) });
  }
}
