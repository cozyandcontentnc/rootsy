// src/auth/AuthProvider.js
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setChecking(false);
    });
    return unsub;
  }, []);

  const value = useMemo(
    () => ({
      user,
      checking,
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, checking]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
