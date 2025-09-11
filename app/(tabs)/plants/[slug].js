// app/(tabs)/plants/[slug].js
import { useEffect, useState, useMemo } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { db } from "../../../src/firebase";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import Card from "../../../components/Card";

export default function PlantDetail() {
  const { slug } = useLocalSearchParams(); // e.g. "tomato"
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // 1) Try doc by ID
        const idRef = doc(db, "plants", String(slug));
        const idSnap = await getDoc(idRef);

        if (idSnap.exists()) {
          if (!cancelled) setPlant({ id: idSnap.id, ...idSnap.data() });
        } else {
          // 2) Fallback: find first doc where field slug == param
          const q = query(
            collection(db, "plants"),
            where("slug", "==", String(slug)),
            limit(1)
          );
          const qs = await getDocs(q);
          if (!qs.empty) {
            const d = qs.docs[0];
            if (!cancelled) setPlant({ id: d.id, ...d.data() });
          } else {
            if (!cancelled) setErr("Plant not found.");
          }
        }
      } catch (e) {
        if (!cancelled) setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (err) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#B3261E", marginBottom: 8 }}>Error: {err}</Text>
        <Text style={{ color: "#6b5a50" }}>
          If this says “Missing or insufficient permissions”, double-check Firestore Rules and that the
          <Text style={{ fontWeight: "700" }}> plants</Text> doc exists.
        </Text>
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Plant not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>{plant.commonName || plant.id}</Text>
      {plant.scientificName ? (
        <Text style={{ color: "#6b5a50" }}>{plant.scientificName}</Text>
      ) : null}

      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>At a glance</Text>
        <Text>Sun: {plant.sun || "—"}</Text>
        <Text>Water: {plant.water || "—"}</Text>
        {plant.daysToMaturity != null ? <Text>Days to maturity: {plant.daysToMaturity}</Text> : null}
      </Card>

      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Sowing & transplanting</Text>
        <Text>Start Indoors: {fmtOffset(plant.startOffsetDays)}</Text>
        <Text>Direct Sow: {fmtRange(plant.directSowFrom, plant.directSowTo)}</Text>
        <Text>Transplant: {fmtRange(plant.transplantFrom, plant.transplantTo)}</Text>
      </Card>
    </ScrollView>
  );
}

function fmtOffset(n) {
  if (n == null) return "—";
  if (n === 0) return "on last frost date";
  return n < 0 ? `${Math.abs(n)} days before last frost` : `${n} days after last frost`;
}
function fmtRange(a, b) {
  if (a == null && b == null) return "—";
  if (a != null && b != null) return `${a} to ${b} days`;
  return `${a ?? b} days`;
}
