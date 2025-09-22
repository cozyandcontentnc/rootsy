// app/(tabs)/plants/bed/[bedId].js
import React, { useEffect, useState, useLayoutEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { auth, db } from "../../../../src/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import usePlantsCsv from "../../../../src/usePlantsCsv";

/** Ultra-reliable button (works on native & web, avoids nested-pressable issues) */
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

// normalize any saved plant doc into a preview the UI expects
function toPreviewFromDb(data = {}, docId = "") {
  const safe = (v) => (typeof v === "string" && v.trim().length ? v : null);

  const name =
    safe(data.name) ||
    safe(data.title) ||
    safe(data.common_name) ||
    "Unknown";

  const binomialName =
    safe(data.binomialName) ||
    safe(data.binomial_name) ||
    safe(data.scientific_name) ||
    safe(data.scientificName) ||
    null;

  const slug = String(
    safe(data.slug) ||
    safe(data.id) ||
    docId ||
    `plant-${Date.now()}`
  );

  const image =
    safe(data.image) ||
    safe(data.main_image_path) ||
    safe(data.thumb_image_url) ||
    (typeof data.attributes === "object" && data.attributes
      ? safe(data.attributes.main_image_path) || safe(data.attributes.thumb_image_url)
      : null) ||
    null;

  const source = safe(data.source) || safe(data._source) || null;

  // 🔧 IMPORTANT: include the Firestore doc ID so deletes can work
  return { id: docId, slug, name, binomialName, image, source };
}

export default function BedScreen() {
  const { bedId, name } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();

  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Inline confirm states
  const [confirmPlantId, setConfirmPlantId] = useState(null);

  // CSV search state
  const { loading: csvLoading, error: csvError, search } = usePlantsCsv();
  const [plantQuery, setPlantQuery] = useState("");
  const csvResults = useMemo(() => search(plantQuery), [plantQuery, search]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: (typeof name === "string" && name) || "Garden Bed" });
  }, [name, navigation]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !bedId) return;

    const qref = query(
      collection(db, "users", uid, "beds", String(bedId), "plants"),
      orderBy("addedAt", "desc")
    );

    const unsub = onSnapshot(
      qref,
      (snap) => {
        const rows = [];
        snap.forEach((docSnap) => rows.push(toPreviewFromDb(docSnap.data() || {}, docSnap.id)));
        setPlants(rows);
        setErr("");
        setLoading(false);
      },
      (e) => {
        setErr(String(e?.message || e));
        setPlants([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [bedId]);

  const openAddPicker = useCallback(() => {
    router.push({ pathname: "/plants/search/[bedId]", params: { bedId } });
  }, [router, bedId]);

  const openDetail = useCallback((item) => {
    const slug = String(item?.slug || `plant-${Date.now()}`);
    const fallback = JSON.stringify({
      id: slug,
      slug,
      name: item?.name || "Unknown",
      binomialName: item?.binomialName || null,
      image: typeof item?.image === "string" ? item.image : null,
    });
    router.push({
      pathname: "/plants/detail/[cropSlug]",
      params: { cropSlug: slug, fallback },
    });
  }, [router]);

  const addCsvPlantToBed = useCallback(
    async (csvItem) => {
      const uid = auth.currentUser?.uid;
      if (!uid || !bedId) return;
      try {
        const payload = {
          name: csvItem.name || "",
          variety: csvItem.variety || "",
          scientificName: csvItem.scientificName || "",
          slug: csvItem.slug || "",
          tags: csvItem.tags || [],
          source: "csv",
          addedAt: serverTimestamp(),
        };
        await addDoc(collection(db, "users", uid, "beds", String(bedId), "plants"), payload);
      } catch (e) {
        setErr(String(e?.message || e));
      }
    },
    [bedId]
  );

  const removePlant = useCallback(
    async (plantId) => {
      const uid = auth.currentUser?.uid;
      if (!uid || !bedId || !plantId) return;
      try {
        await deleteDoc(doc(db, "users", uid, "beds", String(bedId), "plants", String(plantId)));
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setConfirmPlantId(null);
      }
    },
    [bedId]
  );

  if (loading) return <ActivityIndicator style={{ margin: 16 }} />;

  if (err) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#B3261E", marginBottom: 8 }}>Error: {err}</Text>
        <Text style={{ color: "#6b5a50" }}>
          Check rules for <Text style={{ fontWeight: "700" }}>/users/{"{uid}"}/beds/{String(bedId)}/plants</Text>.
        </Text>
      </View>
    );
  }

  return (
    <View style={S.wrap}>
      <PlainButton style={S.addBtn} onPress={openAddPicker} label="Add plant">
        <Text style={S.addBtnTxt}>Add plant</Text>
      </PlainButton>

      {/* Inline CSV search & add */}
      <View style={S.searchBox}>
        <Text style={S.h2}>Add from My CSV Plants</Text>
        <TextInput
          placeholder="Search CSV plants by name, variety…"
          value={plantQuery}
          onChangeText={setPlantQuery}
          style={S.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {csvLoading ? (
          <View style={S.centerRow}>
            <ActivityIndicator />
            <Text style={S.sub}> Loading your plant library…</Text>
          </View>
        ) : csvError ? (
          <Text style={S.err}>Couldn’t load plants.csv: {String(csvError.message || csvError)}</Text>
        ) : plantQuery.trim() ? (
          <FlatList
            data={csvResults}
            keyExtractor={(item) => item.slug || item.name}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <View style={S.csvCard}>
                <View style={{ flex: 1 }}>
                  <Text style={S.title}>
                    {item.name}
                    {item.variety ? ` — ${item.variety}` : ""}
                  </Text>
                  {!!item.scientificName && <Text style={S.sub}>{item.scientificName}</Text>}
                </View>
                <PlainButton
                  style={S.addSmallBtn}
                  onPress={() => addCsvPlantToBed(item)}
                  label={`Add ${item.name} to bed`}
                >
                  <Text style={S.addSmallTxt}>Add</Text>
                </PlainButton>
              </View>
            )}
            ListEmptyComponent={<Text style={S.sub}>No matches.</Text>}
          />
        ) : null}
      </View>

      {plants.length === 0 ? (
        <Text style={S.empty}>No plants yet. Use “Add plant” or search above.</Text>
      ) : (
        <FlatList
          data={Array.isArray(plants) ? plants : []}
          keyExtractor={(i, idx) => (i?.id ? String(i.id) : i?.slug ? String(i.slug) : `k${idx}`)}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={S.card}>
              <PlainButton
                style={{ flexDirection: "row", gap: 12, alignItems: "center", flex: 1 }}
                onPress={() => openDetail(item)}
                label={`Open ${item?.name || "plant"}`}
              >
                {typeof item?.image === "string" && !!item.image ? (
                  <Image source={{ uri: item.image }} style={S.img} />
                ) : (
                  <View style={[S.img, { backgroundColor: "#eee" }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={S.title}>{item?.name || "Unnamed plant"}</Text>
                  {item?.binomialName ? <Text style={S.sub}>{item.binomialName}</Text> : null}
                  {item?.source ? <Text style={S.source}>source: {item.source}</Text> : null}
                </View>
              </PlainButton>

              {confirmPlantId === item.id ? (
                <View style={S.confirmBox}>
                  <PlainButton
                    style={[S.confirmBtn, { backgroundColor: "#9d2b2b" }]}
                    onPress={() => removePlant(item.id)}
                    label="Confirm remove"
                  >
                    <Text style={S.confirmTxt}>Confirm</Text>
                  </PlainButton>
                  <PlainButton
                    style={[S.confirmBtn, { backgroundColor: "#7a6e61" }]}
                    onPress={() => setConfirmPlantId(null)}
                    label="Cancel remove"
                  >
                    <Text style={S.confirmTxt}>Cancel</Text>
                  </PlainButton>
                </View>
              ) : (
                <PlainButton
                  style={S.removeBtn}
                  onPress={() => setConfirmPlantId(item.id)}
                  label={`Remove ${item?.name || item?.slug}`}
                >
                  <Text style={S.removeTxt}>Remove</Text>
                </PlainButton>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#fffaf3" },
  addBtn: {
    backgroundColor: "#A26769",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addBtnTxt: { color: "#fff", textAlign: "center", fontWeight: "700" },

  searchBox: {
    borderWidth: 1,
    borderColor: "#e5dcc9",
    backgroundColor: "#fbf4eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  h2: { fontSize: 16, fontWeight: "800", color: "#4a3f35", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "white",
    borderColor: "#e5dcc9",
    color: "#4a3f35",
    marginBottom: 10,
  },
  centerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  err: { color: "#B3261E" },

  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5dcc9",
    borderRadius: 12,
    backgroundColor: "#fbf4eb",
    marginBottom: 10,
  },
  img: { width: 56, height: 56, borderRadius: 8 },
  title: { fontSize: 16, fontWeight: "700", color: "#4a3f35" },
  sub: { color: "#6b5a50", marginTop: 4 },
  source: { color: "#7f7366", marginTop: 4, fontSize: 12 },

  addSmallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#557755",
  },
  addSmallTxt: { color: "#fff", fontWeight: "800" },

  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5c9c9",
    backgroundColor: "#f9e7e7",
  },
  removeTxt: { color: "#9d2b2b", fontWeight: "800" },

  confirmBox: { flexDirection: "row", gap: 8 },
  confirmBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  confirmTxt: { color: "#fff", fontWeight: "800" },

  empty: { color: "#6b5a50", marginTop: 24 },
});
