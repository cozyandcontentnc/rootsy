// app/(tabs)/plants/
// 🔁 CSV-only version: searches your bundled plants.csv and adds to a bed

import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, FlatList, Image, Pressable,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth, db } from "../../../../src/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import usePlantsCsv from "../../../../src/usePlantsCsv";

const MIN_LEN = 2;

export default function PlantSearch() {
  const { bedId } = useLocalSearchParams();
  const router = useRouter();

  // load local CSV library + build search helper
  const { plants, loading, error, search } = usePlantsCsv();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // simple debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ((q || "").trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => {
    if (!debouncedQ || debouncedQ.length < MIN_LEN) return [];
    return search(debouncedQ);
  }, [debouncedQ, search]);

  const addToBed = async (item) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert("Not signed in", "Please sign in first.");
      return;
    }
    if (!bedId) {
      Alert.alert("Missing bed", "No bed selected.");
      return;
    }

    // build the payload from CSV fields
    const crop = {
      slug: item?.slug || `plant-${Date.now()}`,
      name: item?.name || "Unknown",
      variety: item?.variety || "",
      scientificName: item?.scientificName || "",
      imageUrl: typeof item?.imageUrl === "string" ? item.imageUrl : "",
      source: "local-csv",
    };

    try {
      await addDoc(collection(db, "users", uid, "beds", bedId, "plants"), {
        ...crop,
        addedAt: serverTimestamp(),
      });

      Alert.alert("Added!", `${crop.name}${crop.variety ? ` — ${crop.variety}` : ""} added to your bed.`);
      // go straight back to the bed screen
      router.replace({ pathname: "/plants/bed/[bedId]", params: { bedId } });
    } catch (e) {
      Alert.alert("Error", String(e?.message || e));
    }
  };

  const showEmpty =
    (debouncedQ?.length ?? 0) >= MIN_LEN &&
    !loading &&
    results.length === 0 &&
    !error;

  return (
    <View style={S.wrap}>
      <TextInput
        placeholder={`Search plants — ${MIN_LEN}+ chars`}
        value={q}
        onChangeText={setQ}
        style={S.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={() => setDebouncedQ((q || "").trim())}
      />

      {loading && (
        <View style={{ marginVertical: 12, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={S.sub}>Loading your plant library…</Text>
        </View>
      )}

      {!!error && (
        <Text style={S.err}>
          {String(error.message || error)}
          {Platform.OS === "web" ? "\nTip: ensure assets/data/plants.csv exists." : ""}
        </Text>
      )}

      {showEmpty && <Text style={S.empty}>No plants found. Try a different term.</Text>}

      <FlatList
        data={Array.isArray(results) ? results : []}
        keyExtractor={(i, idx) => (i?.slug ? String(i.slug) : `k${idx}`)}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={S.row}>
            {typeof item?.imageUrl === "string" && !!item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={S.img} />
            ) : (
              <View style={[S.img, { backgroundColor: "#eee" }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={S.title}>
                {item?.name || "Unnamed plant"}
                {item?.variety ? ` — ${item.variety}` : ""}
              </Text>
              {item?.scientificName ? <Text style={S.sub}>{item.scientificName}</Text> : null}
              <Pressable style={S.add} onPress={() => addToBed(item)}>
                <Text style={S.addTxt}>Add to bed</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#fffaf3" },
  input: {
    borderWidth: 1, borderColor: "#e5dcc9", borderRadius: 10,
    padding: 10, backgroundColor: "white", marginBottom: 12, color: "#4a3f35",
  },
  sub: { color: "#6b5a50", marginTop: 6, textAlign: "center" },
  err: { color: "#B3261E", marginVertical: 8, whiteSpace: "pre-wrap" },
  empty: { color: "#6b5a50", marginVertical: 8 },
  row: {
    flexDirection: "row", gap: 12, borderWidth: 1, borderColor: "#e5dcc9",
    borderRadius: 12, padding: 10, backgroundColor: "#fbf4eb", marginBottom: 10,
  },
  img: { width: 64, height: 64, borderRadius: 8 },
  title: { fontWeight: "700", color: "#4a3f35" },
  add: {
    alignSelf: "flex-start", marginTop: 8, backgroundColor: "#A26769",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
  addTxt: { color: "#fff", fontWeight: "700" },
});
