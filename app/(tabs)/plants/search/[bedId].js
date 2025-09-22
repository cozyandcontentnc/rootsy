// app/(tabs)/plants/search/[bedId].js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { auth, db } from "../../../../src/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  query as fsQuery,
  orderBy,
  startAt,
  endAt,
  limit,
  getDocs,
} from "firebase/firestore";

/** Ultra-reliable button (works on native & web, avoids nested-pressable issues) */
function PlainButton({ onPress, style, children, disabled, label }) {
  return (
    <View
      style={[style, disabled ? { opacity: 0.5 } : null]}
      onStartShouldSetResponder={() => !disabled}
      onResponderRelease={() => {
        if (!disabled) onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </View>
  );
}

const MIN_LEN = 2;

export default function PlantSearchForBed() {
  const { bedId, name } = useLocalSearchParams();
  const navigation = useNavigation();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    navigation.setOptions({
      title:
        (typeof name === "string" && name ? `Add to ${name}` : "Add Plant to Bed"),
    });
  }, [name, navigation]);

  // Debounced search in publicPlants (prefix on name_lower)
  useEffect(() => {
    let timer;
    const run = async () => {
      const queryText = (q || "").trim().toLowerCase();
      if (queryText.length < MIN_LEN) {
        setResults([]);
        setLoading(false);
        setErr("");
        return;
      }
      setLoading(true);
      setErr("");
      try {
        const base = fsQuery(
          collection(db, "publicPlants"),
          orderBy("name_lower"),
          startAt(queryText),
          endAt(queryText + "\uf8ff"),
          limit(30)
        );
        const snap = await getDocs(base);
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setResults(rows);
      } catch (e) {
        setErr(String(e?.message || e));
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    timer = setTimeout(run, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const addToBed = useCallback(
    async (item) => {
      const uid = auth.currentUser?.uid;
      if (!uid || !bedId) {
        setErr("You must be signed in and have a valid bed.");
        return;
      }
      try {
        const payload = {
          name: item.name || "",
          variety: item.variety || "",
          scientificName: item.scientificName || "",
          slug: item.slug || item.id || "",
          image: item.imageUrl || "",
          tags: Array.isArray(item.tags) ? item.tags : [],
          source: "library",
          addedAt: serverTimestamp(),
        };
        await addDoc(
          collection(db, "users", uid, "beds", String(bedId), "plants"),
          payload
        );
      } catch (e) {
        setErr(String(e?.message || e));
      }
    },
    [bedId]
  );

  const header = useMemo(
    () => (
      <View style={S.searchBox}>
        <Text style={S.h1}>Search Library</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={`Search plants (min ${MIN_LEN} letters)…`}
          autoCapitalize="none"
          autoCorrect={false}
          style={S.input}
        />
        {loading ? (
          <View style={S.centerRow}>
            <ActivityIndicator />
            <Text style={S.sub}> Searching…</Text>
          </View>
        ) : err ? (
          <Text style={S.err}>Error: {err}</Text>
        ) : q.trim().length < MIN_LEN ? (
          <Text style={S.sub}>
            Type at least {MIN_LEN} letters to search your library.
          </Text>
        ) : null}
      </View>
    ),
    [q, loading, err]
  );

  return (
    <View style={S.wrap}>
      {header}
      <FlatList
        data={results}
        keyExtractor={(item) => item.slug || item.id || item.name}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={S.card}>
            <View style={{ flex: 1 }}>
              <Text style={S.title}>
                {item.name}
                {item.variety ? ` — ${item.variety}` : ""}
              </Text>
              {!!item.scientificName && <Text style={S.sub}>{item.scientificName}</Text>}
            </View>
            <PlainButton
              style={S.addBtn}
              onPress={() => addToBed(item)}
              label={`Add ${item.name}`}
            >
              <Text style={S.addTxt}>Add</Text>
            </PlainButton>
          </View>
        )}
        ListEmptyComponent={
          q.trim().length >= MIN_LEN && !loading && !err ? (
            <Text style={[S.sub, { padding: 12 }]}>No matches.</Text>
          ) : null
        }
      />
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#fffaf3" },

  searchBox: {
    borderWidth: 1,
    borderColor: "#e5dcc9",
    backgroundColor: "#fbf4eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  h1: { fontSize: 18, fontWeight: "800", color: "#4a3f35", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "white",
    borderColor: "#e5dcc9",
    color: "#4a3f35",
  },

  centerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  sub: { color: "#6b5a50", marginTop: 4 },
  err: { color: "#B3261E", marginTop: 8, fontWeight: "700" },

  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5dcc9",
    borderRadius: 12,
    backgroundColor: "#fbf4eb",
  },

  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#557755",
  },
  addTxt: { color: "#fff", fontWeight: "800" },

  title: { fontSize: 16, fontWeight: "700", color: "#4a3f35" },
});
