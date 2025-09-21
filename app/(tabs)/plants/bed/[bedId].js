// app/(tabs)/plants/bed/[bedId].js
import React, { useEffect, useState, useLayoutEffect, useMemo } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { auth, db } from "../../../../src/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

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

  return { slug, name, binomialName, image };
}

export default function BedScreen() {
  const { bedId, name } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();

  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      },
      (err) => {
        console.error("[BedScreen] onSnapshot error:", err);
        setPlants([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [bedId]);

  const empty = useMemo(() => !loading && plants.length === 0, [loading, plants]);

  const openAdd = () => {
    // ✅ use your existing route
    router.push({ pathname: "/plants/search/[bedId]", params: { bedId } });
  };

  const openDetail = (item) => {
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
  };

  if (loading) return <ActivityIndicator style={{ margin: 16 }} />;

  return (
    <View style={S.wrap}>
      <Pressable style={S.addBtn} onPress={openAdd}>
        <Text style={S.addBtnTxt}> Add plant</Text>
      </Pressable>

      {empty ? (
        <Text style={S.empty}>No plants yet. Tap “Add plant”.</Text>
      ) : (
        <FlatList
          data={Array.isArray(plants) ? plants : []}
          keyExtractor={(i, idx) => (i?.slug ? String(i.slug) : `k${idx}`)}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable style={S.card} onPress={() => openDetail(item)}>
              {typeof item?.image === "string" && !!item.image ? (
                <Image source={{ uri: item.image }} style={S.img} />
              ) : (
                <View style={[S.img, { backgroundColor: "#eee" }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={S.title}>{item?.name || "Unnamed plant"}</Text>
                {item?.binomialName ? <Text style={S.sub}>{item.binomialName}</Text> : null}
              </View>
            </Pressable>
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
  empty: { color: "#6b5a50", marginTop: 24 },
});
