// app/(tabs)/plants/index.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  StyleSheet,
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

// CSV loader (local-only plant library)
import usePlantsCsv from "../../../src/usePlantsCsv";

export default function Plants() {
  const router = useRouter();

  // ----- Auth + Beds (unchanged core logic) -----
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [qtext, setQtext] = useState("");
  const [beds, setBeds] = useState([]);
  const [newBed, setNewBed] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  // ----- CSV Plants (local-only library + search) -----
  const { plants, loading: plantsLoading, error: plantsError, search } = usePlantsCsv();
  const [plantQuery, setPlantQuery] = useState("");
  const plantResults = useMemo(() => search(plantQuery), [plantQuery, search]);

  // Loading auth or beds
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

  // Signed-out view (now also shows the local CSV plant browser)
  if (!user) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={S.h1}>Garden Beds</Text>
          <Text style={S.sub}>Sign in to create beds and add plants.</Text>
          <Pressable onPress={() => router.push("/login")} style={S.btn}>
            <Text style={S.btnText}>Go to Login</Text>
          </Pressable>
        </View>

        <View style={S.divider} />

        <PlantsBrowser
          plantQuery={plantQuery}
          setPlantQuery={setPlantQuery}
          plantsLoading={plantsLoading}
          plantsError={plantsError}
          plantResults={plantResults}
          onOpenDetail={(slug) => router.push(`/plants/detail/${slug}`)}
        />
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

  // Signed-in normal UI: Beds manager + CSV plant browser
  return (
    <FlatList
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={S.h1}>Garden Beds</Text>

          {/* Create new bed */}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              placeholder="New bed name (e.g., Front Left)"
              value={newBed}
              onChangeText={setNewBed}
              style={S.input}
            />
            <Pressable onPress={addBed} style={S.btn}>
              <Text style={S.btnText}>Add</Text>
            </Pressable>
          </View>

          {/* Search beds */}
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
        <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <Link
            href={{
              pathname: "/plants/bed/[bedId]",
              params: { bedId: item.id, name: item.name ?? "" },
            }}
          >
            <View>
              <Text style={{ fontWeight: "700", color: "#4a3f35" }}>{item.name}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <Pill>Tap to view plants</Pill>
                <Pill>+ Add plants</Pill>
              </View>
            </View>
          </Link>
        </Card>
      )}
      ListEmptyComponent={
        <Text style={{ color: "#6b5a50", paddingHorizontal: 16 }}>
          No beds yet. Add your first one above.
        </Text>
      }
      ListFooterComponent={
        <View style={{ marginTop: 16 }}>
          <View style={S.divider} />
          <PlantsBrowser
            plantQuery={plantQuery}
            setPlantQuery={setPlantQuery}
            plantsLoading={plantsLoading}
            plantsError={plantsError}
            plantResults={plantResults}
            onOpenDetail={(slug) => router.push(`/plants/detail/${slug}`)}
          />
        </View>
      }
    />
  );
}

function PlantsBrowser({
  plantQuery,
  setPlantQuery,
  plantsLoading,
  plantsError,
  plantResults,
  onOpenDetail,
}) {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={S.h1}>Browse Plants</Text>
      <TextInput
        placeholder="Search by name, variety, alias…"
        value={plantQuery}
        onChangeText={setPlantQuery}
        style={S.input}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {plantsLoading ? (
        <View style={S.center}>
          <ActivityIndicator />
          <Text style={S.sub}>Loading your plant library…</Text>
        </View>
      ) : plantsError ? (
        <View>
          <Text style={{ color: "#B3261E", marginBottom: 4 }}>
            Couldn’t load plants.csv
          </Text>
          <Text style={S.sub}>{String(plantsError.message || plantsError)}</Text>
        </View>
      ) : (
        <FlatList
          data={plantResults}
          keyExtractor={(item) => item.slug || item.name}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpenDetail(item.slug)} style={S.card}>
              <View style={{ flex: 1 }}>
                <Text style={S.cardTitle}>
                  {item.name}
                  {item.variety ? ` — ${item.variety}` : ""}
                </Text>
                {!!item.scientificName && (
                  <Text style={S.sci}>{item.scientificName}</Text>
                )}
                {!!item.tags?.length && (
                  <Text style={S.tags}>{item.tags.join(" · ")}</Text>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={S.sub}>No matches found.</Text>
          }
        />
      )}
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
  divider: {
    height: 1,
    backgroundColor: "#efe7d6",
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    backgroundColor: "#fffaf3",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5dcc9",
    marginHorizontal: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#4a3f35" },
  sci: { fontSize: 13, color: "#6b5a50", marginTop: 2, fontStyle: "italic" },
  tags: { fontSize: 12, color: "#7a6e61", marginTop: 4 },
});
