// src/lib/plantsApi.js
import { auth, db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

// Browse a chunk of published plants
export async function listPublicPlants() {
  const q = query(collection(db, "publicPlants"), orderBy("commonName"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Prefix search via ngrams
export async function searchPublicPlants(prefix) {
  const q = query(
    collection(db, "publicPlants"),
    where("search.ngrams", "array-contains", String(prefix || "").toLowerCase()),
    orderBy("commonName"),
    limit(25)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPublicPlant(id) {
  const ref = doc(db, "publicPlants", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function submitPlantProposal({ targetId = null, diff }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to propose changes.");
  const ref = await addDoc(collection(db, "plantProposals"), {
    targetId,
    type: targetId ? "update" : "create",
    diff,
    createdBy: uid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
