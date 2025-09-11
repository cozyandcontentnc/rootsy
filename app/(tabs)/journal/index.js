// app/(tabs)/journal/index.js
import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, Image, ScrollView, FlatList, Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../../../src/firebase";
import {
  addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Card from "../../../components/Card";

export default function JournalScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState([]); // array of URLs
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return; // gated by auth, but guard anyway

    // Only fetch docs owned by the current user, newest first
    const q = query(
      collection(db, "journalEntries"),
      where("ownerId", "==", uid),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEntries(rows);
    }, (err) => {
      console.error(err);
      Alert.alert("Load error", "Could not load your journal entries.");
    });

    return unsub;
  }, []);

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;

      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Not signed in", "Please sign in to add photos.");
        return;
      }

      // Upload to a user-scoped path that matches your Storage rules
      const blob = await (await fetch(asset.uri)).blob();
      const path = `user_uploads/${uid}/journal/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.jpg`;
      const r = ref(storage, path);
      await uploadBytes(r, blob);
      const url = await getDownloadURL(r);
      setPhotos((p) => [...p, url]);
    } catch (e) {
      Alert.alert("Image error", String(e?.message || e));
    }
  };

  const saveEntry = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert("Not signed in", "Please sign in to save entries.");
      return;
    }
    if (!title.trim() && !body.trim() && photos.length === 0) {
      Alert.alert("Nothing to save", "Add a title, body, or photo.");
      return;
    }
    try {
      await addDoc(collection(db, "journalEntries"), {
        ownerId: uid, // <-- scope to user
        title: title.trim() || null,
        body: body.trim() || null,
        photos,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle("");
      setBody("");
      setPhotos([]);
      Alert.alert("Saved", "Journal entry added.");
    } catch (e) {
      Alert.alert("Save error", String(e?.message || e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Journal</Text>

      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>New Entry</Text>
        <TextInput
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
          style={input}
          placeholderTextColor="#9c8f86"
        />
        <TextInput
          placeholder="Notes"
          value={body}
          onChangeText={setBody}
          multiline
          style={[input, { height: 100, textAlignVertical: "top" }]}
          placeholderTextColor="#9c8f86"
        />

        {/* Photos preview */}
        <ScrollView horizontal style={{ marginVertical: 8 }}>
          {photos.map((u) => (
            <Image
              key={u}
              source={{ uri: u }}
              style={{ width: 96, height: 96, borderRadius: 10, marginRight: 8 }}
            />
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={pickImage} style={btnSecondary}>
            <Text style={btnSecondaryTxt}>Add Photo</Text>
          </Pressable>
          <Pressable onPress={saveEntry} style={btnPrimary}>
            <Text style={btnPrimaryTxt}>Save Entry</Text>
          </Pressable>
        </View>
      </Card>

      <Text style={{ fontWeight: "700" }}>Recent</Text>
      <FlatList
        data={entries}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontWeight: "700" }}>{item.title || "(No title)"}</Text>
            {item.createdAt?.toDate ? (
              <Text style={{ color: "#6b5a50", marginBottom: 6 }}>
                {item.createdAt.toDate().toLocaleString()}
              </Text>
            ) : null}
            {item.body ? <Text style={{ marginBottom: 8 }}>{item.body}</Text> : null}
            {Array.isArray(item.photos) && item.photos.length > 0 ? (
              <ScrollView horizontal>
                {item.photos.map((u) => (
                  <Image
                    key={u}
                    source={{ uri: u }}
                    style={{ width: 96, height: 96, borderRadius: 10, marginRight: 8 }}
                  />
                ))}
              </ScrollView>
            ) : null}
          </Card>
        )}
      />
    </ScrollView>
  );
}

const input = {
  backgroundColor: "white",
  borderWidth: 1,
  borderColor: "#e5dcc9",
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
};

const btnPrimary = {
  backgroundColor: "#A26769",
  padding: 10,
  borderRadius: 10,
  alignItems: "center",
};
const btnPrimaryTxt = { color: "white", fontWeight: "700" };

const btnSecondary = {
  backgroundColor: "#fbf4eb",
  padding: 10,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#e5dcc9",
  alignItems: "center",
};
const btnSecondaryTxt = { color: "#4a3f35", fontWeight: "700" };
