import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import { Mitgliedschaft, Rolle } from '../types';

type Arbeitsbereich = 'eigen' | 'freigabe';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Rolle im aktuell geöffneten Arbeitsbereich */
  rolle: Rolle;
  /** Arbeitsbereich, dessen Daten geladen werden (eigene UID oder die des Inhabers) */
  ownerUid: string | null;
  /** Freigabe, die für dieses Konto hinterlegt ist (falls vorhanden) */
  freigabe: Mitgliedschaft | null;
  arbeitsbereich: Arbeitsbereich;
  setArbeitsbereich: (a: Arbeitsbereich) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const wahlKey = (uid: string) => `soergelfibu:arbeitsbereich:${uid}`;

function leseWahl(uid: string): Arbeitsbereich | null {
  try {
    const v = localStorage.getItem(wahlKey(uid));
    return v === 'eigen' || v === 'freigabe' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Lädt Freigabe-Zeiger und prüft, ob bereits ein eigener Arbeitsbereich
 * existiert. Beides entscheidet, welcher Bereich beim Anmelden geöffnet wird.
 */
async function ladeZugang(user: User) {
  const email = (user.email ?? '').trim().toLowerCase();

  const [eigenerBereich, freigabeSnap] = await Promise.all([
    getDoc(doc(db, 'users', user.uid, 'data', 'main')).catch(() => null),
    email ? getDoc(doc(db, 'mitgliedschaften', email)).catch(() => null) : Promise.resolve(null),
  ]);

  const freigabe = freigabeSnap?.exists() ? (freigabeSnap.data() as Mitgliedschaft) : null;
  return {
    hatEigenenBereich: !!eigenerBereich?.exists(),
    freigabe: freigabe?.ownerUid && freigabe.ownerUid !== user.uid ? freigabe : null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [zugang, setZugang] = useState<{ hatEigenenBereich: boolean; freigabe: Mitgliedschaft | null } | null>(null);
  const [wahl, setWahl] = useState<Arbeitsbereich | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setZugang(null);
        setWahl(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    let abgebrochen = false;
    setLoading(true);
    setWahl(leseWahl(user.uid));
    ladeZugang(user)
      .then((z) => {
        if (abgebrochen) return;
        setZugang(z);
      })
      .catch(() => {
        if (!abgebrochen) setZugang({ hatEigenenBereich: true, freigabe: null });
      })
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const freigabe = zugang?.freigabe ?? null;

  // Ohne ausdrückliche Wahl gilt: wer noch keinen eigenen Arbeitsbereich hat
  // und eingeladen wurde, landet in der Freigabe.
  const arbeitsbereich: Arbeitsbereich =
    freigabe && (wahl === 'freigabe' || (wahl === null && !zugang?.hatEigenenBereich))
      ? 'freigabe'
      : 'eigen';

  const setArbeitsbereich = (a: Arbeitsbereich) => {
    if (!user) return;
    try {
      localStorage.setItem(wahlKey(user.uid), a);
    } catch {
      /* localStorage kann blockiert sein — Wahl gilt dann nur für diese Sitzung */
    }
    setWahl(a);
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    rolle: arbeitsbereich === 'freigabe' ? 'akquise' : 'inhaber',
    ownerUid: user ? (arbeitsbereich === 'freigabe' && freigabe ? freigabe.ownerUid : user.uid) : null,
    freigabe,
    arbeitsbereich,
    setArbeitsbereich,
    signInWithGoogle,
    logout,
  }), [user, loading, arbeitsbereich, freigabe]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
