/**
 * Liest Fetch-Antwort als Text und parst JSON — vermeidet Safari/WebKit:
 * `SyntaxError: The string did not match the expected pattern` bei `response.json()`
 * auf HTML-Fehlerseiten oder leeren Bodies.
 */
export async function readApiJson<T = unknown>(
  res: Response,
): Promise<{ ok: boolean; status: number; data: T | null; rawText: string; jsonError: boolean }> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: res.ok, status: res.status, data: null, rawText, jsonError: true };
  }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(trimmed) as T, rawText, jsonError: false };
  } catch {
    return { ok: res.ok, status: res.status, data: null, rawText, jsonError: true };
  }
}
