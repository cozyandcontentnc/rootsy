// src/firebase.web.js
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FB_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FB_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FB_APP_ID,
};

// Safe (re)initialization
const _app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const app = _app;
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Ensure persistence on web; ignore failures (e.g., private mode)
export const authReady = setPersistence(auth, browserLocalPersistence).catch(() => {});
