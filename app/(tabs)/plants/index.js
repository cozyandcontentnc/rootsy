// app/(tabs)/plants/index.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  getDocs,
  doc,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../src/firebase";
import { useRouter } from "expo-router";
import { smallShadow } from "../../../src/ui/shadows";
import { Link } from "expo-router";

/** Same responder-based button as bed screen */
function PlainButton({ onPress, style, children, disabled, label }) {
  return (
    <View
      style={[style, disabled ? { opacity: 0.5 } : null]}
      onStartShouldSetResponder={() => !disabled}
      onResponderRelease={() => { if (!disabled) onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </View>
  );
}

export default function Plants() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [qtext, setQtext] = useState("");
  const [beds, setBeds] = useState([]);
  const [newBed, setNewBed] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [confirmBedId, setConfirmBedId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!user) {
      setBeds([]);
      setLoading(false);
      setErr("");
      return;
    }

    setLoading(true);
    setErr("");

    const qRef = query(
      collection(db, "users", user.uid, "beds"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setBeds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        setErr(String(e?.message || e));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authChecked, user]);

  const filteredBeds = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    if (!s) return beds;
    return beds.filter((b) => (b.name || "").toLowerCase().includes(s));
  }, [qtext, beds]);

  const addBed = useCallback(async () => {
    if (!user) return;
    const name = newBed.trim();
    if (!name) return;

    try {
      await addDoc(collection(db, "users", user.uid, "beds"), {
        name,
        createdAt: serverTimestamp(),
      });
      setNewBed("");
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }, [newBed, user]);

  const confirmDelete = useCallback((bedId) => setConfirmBedId(bedId), []);
  const cancelDelete = useCallback(() => setConfirmBedId(null), []);

  const actuallyDeleteBed = useCallback(async (bedId) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);

      // delete subcollection plants
      const plantsSnap = await getDocs(
        collection(db, "users", user.uid, "beds", bedId, "plants")
      );
      plantsSnap.forEach((p) =>
        batch.delete(doc(db, "users", user.uid, "beds", bedId, "plants", p.id))
      );

      // delete the bed itself
      batch.delete(doc(db, "users", user.uid, "beds", bedId));

      await batch.commit();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setConfirmBedId(null);
    }
  }, [user]);

  const goToBed = useCallback(
    (bed) => {
      router.push({
        pathname: "/plants/bed/[bedId]",
        params: { bedId: bed.id, name: bed.name ?? "" },
      });
    },
    [router]
  );

  if (!authChecked || loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator />
        <Text style={S.sub}>
          {authChecked ? "Loading garden beds…" : "Checking your sign-in…"}
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={S.h1}>Garden Beds</Text>
        <Text style={S.sub}>Sign in to create beds and add plants.</Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#B3261E", marginBottom: 8 }}>Error: {err}</Text>
        <Text style={{ color: "#6b5a50" }}>
          Make sure your Firestore rules allow access to{" "}
          <Text style={{ fontWeight: "700" }}>/users/{"{uid}"}/beds</Text>.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={S.h1}>Garden Beds</Text>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              placeholder="New bed name (e.g., Front Left)"
              value={newBed}
              onChangeText={setNewBed}
              style={S.input}
            />
            <PlainButton style={S.btn} onPress={addBed} label="Add bed">
              <Text style={S.btnText}>Add</Text>
            </PlainButton>
            <Link href="/plants/catalog">
  <View style={{ alignSelf: "flex-start", backgroundColor: "#7b8b6f", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
    <Text style={{ color: "white", fontWeight: "800" }}>Open Plant Catalog</Text>
  </View>
</Link>
          </View>

          <TextInput
            placeholder="Search beds…"
            value={qtext}
            onChangeText={setQtext}
            style={S.input}
          />
        </View>
      }
      data={filteredBeds}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={S.card}>
          <PlainButton
            onPress={() => goToBed(item)}
            style={{ flex: 1, paddingVertical: 8 }}
            label={`Open bed ${item.name}`}
          >
            <Text style={{ fontWeight: "700", color: "#4a3f35" }}>{item.name}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <Pill>Tap to view plants</Pill>
              <Pill>+ Add plants</Pill>
            </View>
          </PlainButton>

          {confirmBedId === item.id ? (
            <View style={S.confirmWrap}>
              <PlainButton
                style={[S.confirmBtn, { backgroundColor: "#9d2b2b" }]}
                onPress={() => actuallyDeleteBed(item.id)}
                label={`Confirm delete ${item.name}`}
              >
                <Text style={S.confirmTxt}>Confirm</Text>
              </PlainButton>
              <PlainButton
                style={[S.confirmBtn, { backgroundColor: "#7a6e61" }]}
                onPress={cancelDelete}
                label="Cancel delete"
              >
                <Text style={S.confirmTxt}>Cancel</Text>
              </PlainButton>
            </View>
          ) : (
            <PlainButton
              onPress={() => confirmDelete(item.id)}
              style={S.deleteBtn}
              label={`Delete bed ${item.name}`}
            >
              <Text style={S.deleteBtnText}>Delete</Text>
            </PlainButton>
          )}
        </View>
      )}
      ListEmptyComponent={
        <Text style={{ color: "#6b5a50", paddingHorizontal: 16 }}>
          No beds yet. Add your first one above.
        </Text>
      }
    />
  );
}

function Pill({ children }) {
  return (
    <View
      style={{
        backgroundColor: "#fbf4eb",
        borderWidth: 1,
        borderColor: "#e5dcc9",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: "#4a3f35", fontWeight: "700" }}>{children}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  h1: { fontSize: 22, fontWeight: "800", color: "#4a3f35" },
  sub: { color: "#6b5a50", marginTop: 8, textAlign: "center" },
  btn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#A26769",
  },
  btnText: { color: "white", fontWeight: "700" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "white",
    borderColor: "#e5dcc9",
    color: "#4a3f35",
  },
  card: {
    backgroundColor: "#fffaf3",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5dcc9",
    marginHorizontal: 16,
    marginBottom: 8,
    ...smallShadow,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5c9c9",
    backgroundColor: "#f9e7e7",
  },
  deleteBtnText: { color: "#9d2b2b", fontWeight: "800" },

  confirmWrap: { flexDirection: "row", gap: 8 },
  confirmBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  confirmTxt: { color: "#fff", fontWeight: "800" },
});
