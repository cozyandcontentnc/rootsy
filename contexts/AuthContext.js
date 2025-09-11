// contexts/AuthContext.js
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile, signOut
} from "firebase/auth";
import { auth, db } from "../src/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => { setUser(u ?? null); setInitializing(false); },
      ()   => { setUser(null);     setInitializing(false); }
    );
    const t = setTimeout(() => setInitializing(false), 3000);
    return () => { clearTimeout(t); unsub && unsub(); };
  }, []);

  const value = useMemo(() => ({
    user, initializing,
    signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
    signUp: async (email, pw, displayName) => {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      if (displayName) await updateProfile(cred.user, { displayName });
      await setDoc(doc(db, "users", cred.user.uid), {
        email, displayName: displayName || "", createdAt: serverTimestamp()
      }, { merge: true });
      return cred.user;
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
