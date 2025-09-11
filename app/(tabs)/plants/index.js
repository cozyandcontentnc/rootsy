// app/(tabs)/plants/index.js
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../src/firebase";
import { Link, useRouter } from "expo-router";
import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";

export default function Plants() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [qtext, setQtext] = useState("");
  const [beds, setBeds] = useState([]);
  const [newBed, setNewBed] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 1) Wait for auth state first
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  // 2) Once we know auth state, subscribe to this user's beds
  useEffect(() => {
    if (!authChecked) return; // not ready
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

  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    if (!s) return beds;
    return beds.filter((b) => (b.name || "").toLowerCase().includes(s));
  }, [qtext, beds]);

  const addBed = async () => {
    if (!user) return Alert.alert("Not signed in", "Please sign in first.");
    const name = newBed.trim();
    if (!name) return;

    try {
      await addDoc(collection(db, "users", user.uid, "beds"), {
        name,
        createdAt: serverTimestamp(),
      });
      setNewBed("");
    } catch (e) {
      Alert.alert("Error", String(e?.message || e));
    }
  };

  // Loading auth or beds
  if (!authChecked || loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: "#6b5a50" }}>
          {authChecked ? "Loading garden beds…" : "Checking your sign-in…"}
        </Text>
      </View>
    );
  }

  // Signed-out view (no error)
  if (!user) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#4a3f35" }}>
          Garden Beds
        </Text>
        <Text style={{ color: "#6b5a50", marginBottom: 8 }}>
          Sign in to create beds and add plants from OpenFarm.
        </Text>
        <Pressable
          onPress={() => router.push("/login")}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: "#A26769",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  // Error (while signed in)
  if (err) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#B3261E", marginBottom: 8 }}>Error: {err}</Text>
        <Text style={{ color: "#6b5a50" }}>
          Make sure your Firestore rules allow access to{" "}
          <Text style={{ fontWeight: "700" }}>/users/{"{uid}"}/beds</Text> for the signed-in user.
        </Text>
      </View>
    );
  }

  // Signed-in normal UI
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Garden Beds</Text>

      {/* Create new bed */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          placeholder="New bed name (e.g., Front Left)"
          value={newBed}
          onChangeText={setNewBed}
          style={{
            flex: 1,
            borderWidth: 1,
            borderRadius: 10,
            padding: 10,
            backgroundColor: "white",
            borderColor: "#e5dcc9",
          }}
        />
        <Pressable
          onPress={addBed}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: "#A26769",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Add</Text>
        </Pressable>
      </View>

      {/* Search beds */}
      <TextInput
        placeholder="Search beds…"
        value={qtext}
        onChangeText={setQtext}
        style={{
          borderWidth: 1,
          borderRadius: 10,
          padding: 10,
          backgroundColor: "white",
          borderColor: "#e5dcc9",
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ color: "#6b5a50" }}>
            No beds yet. Add your first one above.
          </Text>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 8 }}>
            <Link
              href={{
                pathname: "/plants/bed/[bedId]",
                params: { bedId: item.id, name: item.name ?? "" },
              }}
            >
              <View>
                <Text style={{ fontWeight: "700" }}>{item.name}</Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginTop: 4,
                    flexWrap: "wrap",
                  }}
                >
                  <Pill>Tap to view plants</Pill>
                  <Pill>+ Add from OpenFarm</Pill>
                </View>
              </View>
            </Link>
          </Card>
        )}
      />
    </View>
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
