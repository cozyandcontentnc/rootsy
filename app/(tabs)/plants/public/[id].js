// app/(tabs)/plants/public/[id].js
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getPublicPlant } from "../../../../src/lib/plantsApi";
import Card from "../../../../components/Card";

export default function PublicPlantDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const p = await getPublicPlant(String(id));
        setPlant(p);
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ color: "#6b5a50", marginTop: 8 }}>Loading plant…</Text>
      </View>
    );
  }
  if (err || !plant) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#B3261E", fontWeight: "700" }}>
          {err || "Not found."}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fffaf3" }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#4a3f35" }}>
        {plant.commonName || plant.scientificName}
      </Text>
      {!!plant.scientificName && <Text style={{ color: "#6b5a50" }}>{plant.scientificName}</Text>}

      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Basics</Text>
        {!!plant.sun && <Text>Sun: {plant.sun}</Text>}
        {!!plant.water && <Text>Water: {plant.water}</Text>}
        {!!plant.daysToMaturity && <Text>Days to maturity: {plant.daysToMaturity}</Text>}
        {!!plant.soilNotes && <Text style={{ marginTop: 6 }}>{plant.soilNotes}</Text>}
      </Card>

      <Pressable
        onPress={() => router.push({ pathname: "/plants/propose", params: { targetId: plant.id } })}
        style={{ backgroundColor: "#A26769", padding: 12, borderRadius: 10, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>Suggest an edit</Text>
      </Pressable>
    </ScrollView>
  );
}
