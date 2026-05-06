import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Schnelltest, ob Serverless-Funktionen auf Vercel laufen (GET). */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, route: 'api/ping', zeit: new Date().toISOString() });
}
