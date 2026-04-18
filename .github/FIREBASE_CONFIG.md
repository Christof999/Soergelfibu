# Firebase Konfiguration für Soergelfibu

Diese Datei enthält die Firebase SDK-Konfigurationswerte, die als Umgebungsvariablen in Vercel gesetzt werden müssen.

## Vercel Umgebungsvariablen

In der [Vercel Dashboard](https://vercel.com) → Projekt → Settings → Environment Variables folgende Variablen setzen:

| Variable | Wert |
|----------|------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyBYODolh9BJw9Y-nMvIo6DIoAwiH3GP7sc` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `soergelfibu.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `soergelfibu` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `soergelfibu.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `215745047461` |
| `VITE_FIREBASE_APP_ID` | `1:215745047461:web:56e719b84af5f5e764964c` |

## Firebase Projekt

- **Projekt-ID**: `soergelfibu`
- **Konsole**: https://console.firebase.google.com/project/soergelfibu/overview
- **Auth-Domain**: `soergelfibu.firebaseapp.com`

## Aktivierte Dienste

- ✅ Google Sign-In (Firebase Authentication)
- ✅ Firestore in Region `eur3` (Produktionsmodus)
- ✅ Firestore Security Rules deployed
- ✅ Authorized Domains: `localhost`, `soergelfibu.vercel.app`, `soergelfibu.firebaseapp.com`, `soergelfibu.web.app`
