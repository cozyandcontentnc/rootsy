// app/(tabs)/index.js
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Platform,
  ImageBackground,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import Card from "../../components/Card";
import { getWeather } from "../../src/weather";
import { auth, db } from "../../src/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  limit,
} from "firebase/firestore";

/** Theme */
const C = {
  bg: "#F5F3EE",
  bgAlt: "#FBF7F0",
  text: "#4a3f35",
  sub: "#6b5a50",
  border: "#e5dcc9",
  chip: "#F0E8D9",
  white: "#fff",
  terracotta: "#AE8E6E",
  terracottaLight: "#F3E6DC",
};

const FALLBACK = { lat: 35.182, lon: -83.381 }; // Franklin, NC
const GEO_TIMEOUT_MS = 3000;
const WX_TIMEOUT_MS = 4000;

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Helpers */
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23,59,59,999); return d; }
function numOrDash(n, suffix = "") { return n == null ? "—" : `${Math.round(n)}${suffix}`; }
function precipOrDash(n) { if (n == null) return "—"; return `${n.toFixed(n > 0 && n < 1 ? 2 : 1)}"`; }

export default function Home() {
  const router = useRouter();
  const [coords, setCoords] = useState(null);
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Today Tasks (live) ---
  const [tasks, setTasks] = useState(null); // null = loading
  const [quickNote, setQuickNote] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setTasks([]); return; }
    const start = Timestamp.fromDate(startOfToday());
    const end = Timestamp.fromDate(endOfToday());
    const qRef = query(
      collection(db, "tasks"),
      where("ownerId", "==", uid),
      where("dueAt", ">=", start),
      where("dueAt", "<", end),
      where("done", "==", false),
      orderBy("dueAt", "asc"),
      limit(100)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setTasks([])
    );
    return () => unsub();
  }, []);

  const toggleTask = useCallback(async (taskId, done) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        done: !done,
        doneAt: !done ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
    } catch (e) { Alert.alert("Update error", String(e?.message || e)); }
  }, []);

  const quickAddToday = useCallback(async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) { Alert.alert("Not signed in", "Please sign in to add tasks."); return; }
      const note = quickNote.trim();
      if (!note) { Alert.alert("Empty", "Type a short note for the task."); return; }
      await addDoc(collection(db, "tasks"), {
        ownerId: uid, type: "custom", notes: note,
        dueAt: Timestamp.fromDate(startOfToday()),
        done: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setQuickNote("");
    } catch (e) { Alert.alert("Add error", String(e?.message || e)); }
  }, [quickNote]);

  // --- Overdue (before today, not done) ---
  const [overdueCount, setOverdueCount] = useState(0);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setOverdueCount(0); return; }
    const start = Timestamp.fromDate(startOfToday());
    const qRef = query(
      collection(db, "tasks"),
      where("ownerId", "==", uid),
      where("dueAt", "<", start),
      where("done", "==", false),
      orderBy("dueAt", "asc"),
      limit(200)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => setOverdueCount(snap.size),
      () => setOverdueCount(0)
    );
    return () => unsub();
  }, []);

  // --- GEO + WEATHER ---
  useEffect(() => {
    (async () => {
      try {
        let c = FALLBACK;
        if (Platform.OS !== "web") {
          try {
            const { status } = await withTimeout(Location.requestForegroundPermissionsAsync(), GEO_TIMEOUT_MS);
            if (status === "granted") {
              const loc = await withTimeout(Location.getCurrentPositionAsync({}), GEO_TIMEOUT_MS);
              c = { lat: loc.coords.latitude, lon: loc.coords.longitude };
            }
          } catch {}
        }
        setCoords(c);
        try { const data = await withTimeout(getWeather(c.lat, c.lon), WX_TIMEOUT_MS); setWx(data); } catch {}
      } finally { setLoading(false); }
    })();
  }, []);

  const minToday = wx?.daily?.temperature_2m_min?.[0] ?? null;
  const maxToday = wx?.daily?.temperature_2m_max?.[0] ?? null;
  const precipToday = wx?.daily?.precipitation_sum?.[0] ?? null;

  const frostOutlook = useMemo(() => {
    const mins = wx?.daily?.temperature_2m_min ?? [];
    const next3 = mins.slice(0, 3);
    if (!next3.length) return { level: "—", msg: "No forecast data." };
    const min3 = Math.min(...next3);
    if (min3 <= 32) return { level: "Frost", msg: "Protect tender plants overnight." };
    if (min3 <= 36) return { level: "Watch", msg: "Possible light frost; consider covers." };
    return { level: "None", msg: "No frost expected in the next few nights." };
  }, [wx]);

  const plantOfDay = useMemo(() => {
    const plants = [
      { name: "Basil", tip: "Pinch tops to keep it bushy; avoid flowering.", icon: "🌿" },
      { name: "Tomato", tip: "Water deeply; mulch to prevent splash.", icon: "🍅" },
      { name: "Lavender", tip: "Full sun, sharp drainage; trim after blooms.", icon: "💜" },
      { name: "Mint", tip: "Grow in containers to limit spread.", icon: "🌱" },
      { name: "Strawberry", tip: "Remove runners for bigger berries.", icon: "🍓" },
      { name: "Rosemary", tip: "Let soil dry slightly between waterings.", icon: "🌿" },
      { name: "Marigold", tip: "Deadhead to extend blooms & deter pests.", icon: "🌼" },
    ];
    const i = new Date().getDate() % plants.length;
    return plants[i];
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/bg-garden-paper.jpg")}
      resizeMode="stretch"
      style={{ flex: 1, width: "100%", height: "100%" }}
      imageStyle={{ opacity: 0.85 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* HERO */}
        <View style={styles.heroWrap}>
          <View style={styles.heroEmojiCol}>
            <Text style={styles.heroEmoji}>🌿</Text>
            <Text style={styles.heroEmojiSmall}>🪴</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Rootsy</Text>
            <Text style={styles.heroSub}>Tend your garden, season by season.</Text>
            {coords ? (
              <Text style={styles.heroWx}>
                Today: low {numOrDash(minToday, "°F")} • high {numOrDash(maxToday, "°F")} • precip {precipOrDash(precipToday)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* OVERDUE ALERT STRIP */}
        {overdueCount > 0 && (
          <Pressable
            onPress={() => router.push("/(tabs)/tasks?focus=overdue")}
            accessibilityRole="button"
            accessibilityLabel="View overdue tasks"
            style={styles.overdueStrip}
          >
            <Text style={styles.overdueText}>
              ⏰ {overdueCount} task{overdueCount === 1 ? "" : "s"} overdue — tap to review.
            </Text>
          </Pressable>
        )}

        {/* TODAY — Firestore-backed */}
        <Card>
          <Text style={styles.cardTitle}>Today</Text>

          {/* Quick Add */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput
              value={quickNote}
              onChangeText={setQuickNote}
              placeholder="Quick add (e.g., Water basil)"
              placeholderTextColor="#9c8f86"
              style={styles.input}
            />
            <Pressable onPress={quickAddToday} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryTxt}>Add</Text>
            </Pressable>
          </View>

          {/* List */}
          {tasks === null ? (
            <Text style={[styles.cardSub, { marginTop: 8 }]}>Loading tasks…</Text>
          ) : tasks.length === 0 ? (
            <Text style={[styles.cardSub, { marginTop: 8 }]}>You’re all caught up. 🌤️</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {tasks.map((t) => (
                <Pressable key={t.id} onPress={() => toggleTask(t.id, t.done)} style={styles.taskRow}>
                  <View style={[styles.checkbox, t.done && styles.checkboxOn]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskText}>{t.type?.toUpperCase?.() || "TASK"}</Text>
                    {t.notes ? <Text style={styles.taskMeta}>{t.notes}</Text> : null}
                  </View>
                  <Text style={[styles.donePill, t.done ? styles.donePillOn : null]}>
                    {t.done ? "Done" : "Tap to complete"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        {/* Weather Snapshot */}
        <Card>
          <Text style={styles.cardTitle}>Weather Snapshot</Text>
          <View style={styles.wxRow}>
            <WxStat label="Low" value={numOrDash(minToday, "°F")} />
            <Divider />
            <WxStat label="High" value={numOrDash(maxToday, "°F")} />
            <Divider />
            <WxStat label="Precip" value={precipOrDash(precipToday)} />
          </View>
          <Text style={styles.cardHint}>Tip: Skip watering if rainfall ≥ 0.25" in the past 24h.</Text>
        </Card>

        {/* 🌱 Garden shortcuts — NEW */}
        <Card>
          <Text style={styles.cardTitle}>Your Garden</Text>
          <Text style={styles.cardSub}>Manage beds and add plants from OpenFarm.</Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <Pressable
              style={styles.btnHollow}
              onPress={() => router.push("/(tabs)/plants")}
            >
              <Text style={styles.btnHollowTxt}>Open Garden Beds</Text>
            </Pressable>

            <Pressable
              style={styles.btnHollow}
              onPress={() => router.push("/(tabs)/plants?focus=new")}
            >
              <Text style={styles.btnHollowTxt}>Add a Bed</Text>
            </Pressable>
          </View>

          <Text style={[styles.cardHint, { marginTop: 10 }]}>
            To add plants from OpenFarm: open a bed → “Add plant from OpenFarm”.
          </Text>
        </Card>

        {/* Watering Radar (placeholder; wire later) */}
        <Card>
          <Text style={styles.cardTitle}>Watering Radar</Text>
          <Text style={styles.cardSub}>Connect plant schedules to see live status here.</Text>
          <View style={styles.badgeGrid}>
            <StatusBadge tone="due">Bed A — Tomatoes</StatusBadge>
            <StatusBadge tone="soon">Herbs — Pots</StatusBadge>
            <StatusBadge tone="ok">North Bed — Peppers</StatusBadge>
            <StatusBadge tone="ok">Trellis — Cucumbers</StatusBadge>
          </View>
        </Card>

        {/* Frost Watch */}
        <Card>
          <Text style={styles.cardTitle}>Frost Watch (next 3 nights)</Text>
          <View style={styles.frostRow}>
            <FrostPill level={frostOutlook.level} />
            <Text style={[styles.cardSub, { flex: 1, marginLeft: 10 }]}>{frostOutlook.msg}</Text>
          </View>
        </Card>

        {/* Plant of the Day */}
        <Card>
          <Text style={styles.cardTitle}>Plant of the Day</Text>
          <View style={styles.podRow}>
            <Text style={styles.podIcon}>{plantOfDay.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.podName}>{plantOfDay.name}</Text>
              <Text style={styles.cardSub}>{plantOfDay.tip}</Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>
    </ImageBackground>
  );
}

/* Small components */
const WxStat = ({ label, value }) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Text style={styles.wxLabel}>{label}</Text>
    <Text style={styles.wxValue}>{value}</Text>
  </View>
);
const Divider = () => <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 8 }} />;

const StatusBadge = ({ tone = "ok", children }) => {
  const map = {
    ok: { bg: "#E9F3EB", fg: "#2E5E3A", emoji: "✅" },
    soon: { bg: "#FFF3D6", fg: "#7A5A1B", emoji: "⌛" },
    due: { bg: "#FDE8E8", fg: "#7A1B1B", emoji: "💧" },
  };
  const t = map[tone] ?? map.ok;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{t.emoji} {children}</Text>
    </View>
  );
};

const FrostPill = ({ level }) => {
  const map = {
    None: { bg: "#E9F3EB", fg: "#2E5E3A", label: "No Frost" },
    Watch: { bg: "#FFF3D6", fg: "#7A5A1B", label: "Watch" },
    Frost: { bg: "#FDE8E8", fg: "#7A1B1B", label: "Frost" },
    "—": { bg: C.chip, fg: C.sub, label: "—" },
  };
  const s = map[level] ?? map["—"];
  return (
    <View style={[styles.frostPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.frostPillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
};

/* Styles */
const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  container: { padding: 16, gap: 16, backgroundColor: "transparent" },

  // HERO
  heroWrap: {
    backgroundColor: C.bgAlt,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 18, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  heroEmojiCol: { alignItems: "center", gap: 6, marginRight: 8 },
  heroEmoji: { fontSize: 44 },
  heroEmojiSmall: { fontSize: 24, opacity: 0.9 },
  heroTitle: { fontSize: 26, fontWeight: "800", color: C.text },
  heroSub: { color: C.sub, marginTop: 2 },
  heroWx: { marginTop: 8, color: C.text },

  // OVERDUE STRIP
  overdueStrip: {
    backgroundColor: C.terracottaLight,
    borderWidth: 1,
    borderColor: C.terracotta,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  overdueText: { color: C.text, fontWeight: "700" },

  // CARDS
  cardTitle: { fontSize: 18, fontWeight: "800", color: C.text, marginBottom: 6 },
  cardSub: { color: C.sub },

  input: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    color: C.text,
  },
  btnPrimary: {
    backgroundColor: "#A26769",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  btnPrimaryTxt: { color: "white", fontWeight: "700" },

  btnHollow: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnHollowTxt: { color: C.text, fontWeight: "700" },

  wxRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginTop: 6,
  },
  wxLabel: { color: C.sub, fontSize: 12 },
  wxValue: { color: C.text, fontSize: 18, fontWeight: "700", marginTop: 2 },
  cardHint: { color: C.sub, fontSize: 12, marginTop: 8 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  badge: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border },
  badgeText: { fontSize: 13, fontWeight: "600" },

  frostRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  frostPill: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  frostPillText: { fontWeight: "700" },

  // TODAY list
  taskRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 2, borderColor: C.sub, backgroundColor: "transparent",
  },
  checkboxOn: { backgroundColor: "#7BA47E", borderColor: "#7BA47E" },
  taskText: { color: C.text, fontSize: 15, fontWeight: "700" },
  taskMeta: { color: C.sub, fontSize: 13, marginTop: 2 },
  donePill: {
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, fontSize: 12, color: C.sub,
  },
  donePillOn: { backgroundColor: "#E9F3EB", color: "#2E5E3A", borderColor: "#CFE3D3" },

  // POD
  podRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  podIcon: { fontSize: 36 },
  podName: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 2 },
});
