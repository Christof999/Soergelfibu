import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, plz = '91732', radius = 50000 } = req.body as {
    query: string;
    plz?: string;
    radius?: number;
  };

  const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!PLACES_KEY) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY nicht konfiguriert' });

  try {
    // 1. PLZ in Koordinaten auflösen (Geocoding API)
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(plz)}&key=${PLACES_KEY}`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) {
      return res.status(400).json({ error: `PLZ ${plz} nicht gefunden` });
    }
    const { lat, lng } = geoData.results[0].geometry.location;

    // 2. Nearby Search (Places API) – mehrere Seiten laden
    const ergebnisse: Place[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        location: `${lat},${lng}`,
        radius: String(radius),
        keyword: query,
        language: 'de',
        key: PLACES_KEY,
        ...(pageToken ? { pagetoken: pageToken } : {}),
      });

      if (pageToken) await new Promise(r => setTimeout(r, 2000)); // Places API braucht kurze Pause

      const placesRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
      );
      const placesData = await placesRes.json();

      if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
        return res.status(500).json({ error: `Places API: ${placesData.status}`, detail: placesData.error_message });
      }

      for (const place of placesData.results ?? []) {
        // Details für jeden Eintrag holen (Telefon, Website, E-Mail)
        const detailParams = new URLSearchParams({
          place_id: place.place_id,
          fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types',
          language: 'de',
          key: PLACES_KEY,
        });
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?${detailParams}`
        );
        const detailData = await detailRes.json();
        const d = detailData.result ?? {};

        ergebnisse.push({
          placeId: place.place_id,
          name: d.name ?? place.name,
          adresse: d.formatted_address ?? place.vicinity ?? '',
          telefon: d.formatted_phone_number ?? '',
          website: d.website ?? '',
          email: '',
          branche: (place.types ?? []).filter((t: string) => t !== 'point_of_interest' && t !== 'establishment').slice(0, 2).join(', '),
          bewertung: d.rating ?? 0,
          bewertungsAnzahl: d.user_ratings_total ?? 0,
        });
      }

      pageToken = placesData.next_page_token;
    } while (pageToken && ergebnisse.length < 40);

    return res.status(200).json({ ergebnisse: ergebnisse.slice(0, 40) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Interner Fehler', detail: String(err) });
  }
}

interface Place {
  placeId: string;
  name: string;
  adresse: string;
  telefon: string;
  website: string;
  email: string;
  branche: string;
  bewertung: number;
  bewertungsAnzahl: number;
}
