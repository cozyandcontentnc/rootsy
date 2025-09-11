import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { auth, db } from "../../../../src/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const BASE = "https://openfarm.cc/api/v1";

async function getCrop(slug) {
  const res = await fetch(`${BASE}/crops/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch crop");
  return res.json();
}

export default function PlantDetail() {
  const { cropSlug, fallback } = useLocalSearchParams();
  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const uid = auth.currentUser?.uid;
        const cacheRef = doc(db, "users", uid, "openfarm_cache", cropSlug);
        const snap = await getDoc(cacheRef);
        if (snap.exists()) {
          setA(snap.data().attributes);
          setLoading(false);
          refresh(uid, cacheRef);
          return;
        }
        const json = await getCrop(cropSlug);
        setA(json?.data?.attributes);
        await setDoc(
          cacheRef,
          { attributes: json?.data?.attributes, cachedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        Alert.alert("Error", String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [cropSlug]);

  const refresh = async (uid, cacheRef) => {
    try {
      const json = await getCrop(cropSlug);
      setA(json?.data?.attributes);
      await setDoc(
        cacheRef,
        { attributes: json?.data?.attributes, cachedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {}
  };

  if (loading) return <ActivityIndicator style={{ margin: 20 }} />;

  if (!a)
    return (
      <View style={{ padding: 16 }}>
        <Text>No data for this crop.</Text>
      </View>
    );

  return (
    <ScrollView style={S.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={S.h1}>{a.name}</Text>
      {a.binomial_name ? <Text style={S.sub}>{a.binomial_name}</Text> : null}
      {a.main_image_path ? (
        <Image source={{ uri: a.main_image_path }} style={S.img} />
      ) : null}

      <Section title="At a glance">
        <Row label="Sun" value={a.sun_requirements} />
        <Row label="Water" value={a.water_requirements} />
        <Row label="Height" value={a.height} />
      </Section>

      <Section title="Sowing">
        <Row label="Method" value={a.sowing_method} />
        <Row label="Days to germinate" value={a.germination_days} />
        {a.description ? <Text style={S.p}>{a.description}</Text> : null}
      </Section>

      <Section title="Transplanting">
        <Row label="Spacing" value={a.spacing} />
        <Row label="When" value={a.when_to_transplant} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={S.section}>
      <Text style={S.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <View style={S.row}>
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={S.rowVal}>{String(value)}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fffaf3" },
  h1: { fontSize: 22, fontWeight: "800", color: "#4a3f35" },
  sub: { color: "#6b5a50", marginTop: 4, marginBottom: 12 },
  img: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: "#fbf4eb",
  },
  section: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#fbf4eb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5dcc9",
  },
  sectionTitle: { fontWeight: "800", color: "#4a3f35", marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  rowLabel: { color: "#6b5a50" },
  rowVal: { color: "#4a3f35", fontWeight: "600" },
  p: { color: "#4a3f35", marginTop: 6, lineHeight: 20 },
});
