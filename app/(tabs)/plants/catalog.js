// app/(tabs)/plants/catalog.js
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { listPublicPlants, searchPublicPlants } from "../../../src/lib/plantsApi";
import Card from "../../../components/Card";

export default function Catalog() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = q.trim()
          ? await searchPublicPlants(q.trim().toLowerCase())
          : await listPublicPlants();
        setItems(data);
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [q]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: "#fffaf3" }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#4a3f35" }}>Plant Catalog</Text>
      <TextInput
        placeholder="Search (e.g., tomato)…"
        value={q}
        onChangeText={setQ}
        style={{
          borderWidth: 1, borderColor: "#e5dcc9", backgroundColor: "white", borderRadius: 10, padding: 10
        }}
      />
      {loading ? (
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <ActivityIndicator />
          <Text style={{ color: "#6b5a50", marginTop: 8 }}>Loading…</Text>
        </View>
      ) : err ? (
        <Text style={{ color: "#B3261E" }}>{err}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <Card>
              <Pressable onPress={() => router.push(`/plants/public/${item.id}`)}>
                <Text style={{ fontWeight: "800", color: "#4a3f35" }}>
                  {item.commonName || item.scientificName || item.id}
                </Text>
                {!!item.scientificName && (
                  <Text style={{ color: "#6b5a50", marginTop: 2 }}>{item.scientificName}</Text>
                )}
              </Pressable>
            </Card>
          )}
          ListEmptyComponent={<Text style={{ color: "#6b5a50" }}>No results.</Text>}
        />
      )}
    </View>
  );
}
