// src/userData.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

/** Build a user-scoped query for a top-level collection, ordered by createdAt desc. */
export function userQuery(collName) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  return query(
    collection(db, collName),
    where("ownerId", "==", uid),
    orderBy("createdAt", "desc")
  );
}

/** Subscribe to a user-scoped collection. Returns unsubscribe fn. */
export function subscribeUserDocs(collName, setItems) {
  const q = userQuery(collName);
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setItems(items);
  });
}

/** Create a user-scoped document with server timestamp. */
export async function createUserDoc(collName, data) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  return addDoc(collection(db, collName), {
    ...data,
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Update a doc (still enforced by security rules). */
export async function updateUserDoc(collName, id, data) {
  await updateDoc(doc(db, collName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a doc (still enforced by security rules). */
export async function deleteUserDoc(collName, id) {
  await deleteDoc(doc(db, collName, id));
}
