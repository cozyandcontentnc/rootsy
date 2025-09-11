import { useEffect, useState, useLayoutEffect } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth, db } from "../../../../src/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

export default function BedScreen() {
  const { bedId, name } = useLocalSearchParams();
  const router = useRouter();
  const [plants, setPlants] = useState([]);

  useLayoutEffect(() => {
    router.setParams({ title: name || "Garden Bed" });
  }, [name]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !bedId) return;
    const q = query(
      collection(db, "users", uid, "beds", bedId, "plants"),
      orderBy("addedAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setPlants(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [bedId]);

  return (
    <View style={S.wrap}>
      <Pressable
        style={S.addBtn}
        onPress={() => router.push(`/plants/search/${bedId}`)}
      >
        <Text style={S.addBtnTxt}>+ Add plant from OpenFarm</Text>
      </Pressable>

      <FlatList
        data={plants}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Pressable
            style={S.card}
            onPress={() =>
              router.push({
                pathname: `/plants/detail/${item.cropSlug}`,
                params: { fallback: JSON.stringify(item) },
              })
            }
          >
            <Text style={S.title}>{item.name}</Text>
            {item.binomialName ? (
              <Text style={S.sub}>{item.binomialName}</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={S.empty}>No plants yet. Tap “Add plant”.</Text>
        }
      />
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
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5dcc9",
    borderRadius: 12,
    backgroundColor: "#fbf4eb",
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#4a3f35" },
  sub: { color: "#6b5a50", marginTop: 4 },
  empty: { color: "#6b5a50", marginTop: 24 },
});
