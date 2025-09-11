import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth, db } from "../../../../src/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";

const BASE = "https://openfarm.cc/api/v1";

async function searchCrops(query, page = 1) {
  const url = `${BASE}/crops/?filter=${encodeURIComponent(query)}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export default function PlantSearch() {
  const { bedId } = useLocalSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim()) doSearch(q);
      else setResults([]);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const doSearch = async (term) => {
    try {
      setLoading(true);
      const json = await searchCrops(term);
      setResults(json?.data || []);
    } catch (e) {
      Alert.alert("OpenFarm error", String(e));
    } finally {
      setLoading(false);
    }
  };

  const addToBed = async (node) => {
    const a = node.attributes || {};
    const crop = {
      slug: a.slug || node.id,
      name: a.name || "Unknown",
      binomialName: a.binomial_name || null,
      image: a.main_image_path || null,
    };
    const uid = auth.currentUser?.uid;
    try {
      await addDoc(collection(db, "users", uid, "beds", bedId, "plants"), {
        ...crop,
        addedAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "users", uid, "openfarm_cache", crop.slug),
        { attributes: a, cachedAt: serverTimestamp() },
        { merge: true }
      );
      router.back();
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  };

  return (
    <View style={S.wrap}>
      <TextInput
        placeholder="Search OpenFarm (e.g., tomato, basil)"
        value={q}
        onChangeText={setQ}
        style={S.input}
      />
      {loading && <ActivityIndicator style={{ margin: 12 }} />}
      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => {
          const a = item.attributes || {};
          return (
            <View style={S.row}>
              {!!a.main_image_path && (
                <Image source={{ uri: a.main_image_path }} style={S.img} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={S.title}>{a.name}</Text>
                {a.binomial_name ? (
                  <Text style={S.sub}>{a.binomial_name}</Text>
                ) : null}
                <Pressable style={S.add} onPress={() => addToBed(item)}>
                  <Text style={S.addTxt}>Add to bed</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#fffaf3" },
  input: {
    borderWidth: 1,
    borderColor: "#e5dcc9",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "white",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5dcc9",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fbf4eb",
    marginBottom: 10,
  },
  img: { width: 64, height: 64, borderRadius: 8 },
  title: { fontWeight: "700", color: "#4a3f35" },
  sub: { color: "#6b5a50" },
  add: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#A26769",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addTxt: { color: "#fff", fontWeight: "700" },
});
