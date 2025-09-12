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
// import Card from "../../components/Card"; // no longer used
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
import SeedPacket from "../../components/SeedPacket";
import { useWindowDimensions } from "react-native";

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

/** Layout */
const CONTAINER_HPADDING = 12; // matches styles.container horizontal padding
const H_GAP = 10;              // desired horizontal space *between* packets

/** Helpers */
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23,59,59,999); return d; }
function isoDay(d) { return d.toISOString().slice(0,10); }
function isFiniteNum(n){ return typeof n === "number" && isFinite(n); }
function firstNum(...vals){ for (const v of vals){ if (isFiniteNum(v)) return v; } return null; }
function numOrDash(n, suffix = "") { return n == null ? "—" : `${Math.round(n)}${suffix}`; }
function precipOrDash(n) { if (n == null) return "—"; return `${n.toFixed(n > 0 && n < 1 ? 2 : 1)}"`; }

/** Compute min/max for *today* from hourly if daily fields are missing */
function computeFromHourlyToday(wx, op = "max") {
  const temps = wx?.hourly?.temperature_2m;
  const times = wx?.hourly?.time;
  if (!Array.isArray(temps) || !Array.isArray(times) || temps.length !== times.length) return null;
  const today = isoDay(startOfToday());
  const todayTemps = [];
  for (let i = 0; i < times.length; i++) {
    if (typeof times[i] === "string" && times[i].startsWith(today)) {
      const t = temps[i];
      if (isFiniteNum(t)) todayTemps.push(t);
    }
  }
  if (!todayTemps.length) return null;
  return op === "min" ? Math.min(...todayTemps) : Math.max(...todayTemps);
}

/** Tiny seasonal tagline */
function getSeasonTagline(date = new Date()){
  const m = date.getMonth(); // 0-11
  const day = date.getDate();
  const seasonal = [
    "Seed • Nurture • Bloom",
    "Tend little things often",
    "Grow where you’re planted",
    "Small steps, steady roots",
  ];
  let season = "Season of Growth";
  if (m<=1 || (m===2 && day<20)) season = "Winter Rest";
  else if (m<5 || (m===5 && day<21)) season = "Spring Planting";
  else if (m<8 || (m===8 && day<23)) season = "Summer Care";
  else season = "Fall Harvest";

  const tag = seasonal[day % seasonal.length];
  return `${season} • ${tag}`;
}

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

  // --- Beds (live) ---
  const [beds, setBeds] = useState(null); // null = loading
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setBeds([]); return; }
    const qRef = query(
      collection(db, "beds"),
      where("ownerId", "==", uid),
      orderBy("name", "asc"),
      limit(24)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => setBeds(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setBeds([]) // fallback on error
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

  // === Robust daily min/max with fallbacks ===
  const minToday = useMemo(() => firstNum(
    wx?.daily?.temperature_2m_min?.[0],
    wx?.daily?.apparent_temperature_min?.[0],
    computeFromHourlyToday(wx, "min")
  ), [wx]);

  const maxToday = useMemo(() => firstNum(
    wx?.daily?.temperature_2m_max?.[0],
    wx?.daily?.apparent_temperature_max?.[0],
    computeFromHourlyToday(wx, "max")
  ), [wx]);

  const precipToday = wx?.daily?.precipitation_sum?.[0] ?? null;

  const frostOutlook = useMemo(() => {
    const mins = wx?.daily?.temperature_2m_min ?? [];
    const next3 = mins.slice(0, 3).filter(isFiniteNum);
    if (!next3.length) return { level: "—", msg: "No forecast data." };
    const min3 = Math.min(...next3);
    if (min3 <= 32) return { level: "Frost", msg: "Protect tender plants overnight." };
    if (min3 <= 36) return { level: "Watch", msg: "Possible light frost; consider covers." };
    return { level: "None", msg: "No frost expected in the next few nights." };
  }, [wx]);

  // Dynamic header text
  const displayName = auth.currentUser?.displayName || "Gardener";
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);
  const seasonTag = useMemo(() => getSeasonTagline(), []);

  // 🔷 Even spacing across the row
  const { width: screenW } = useWindowDimensions();
  const cols = useMemo(() => {
    if (screenW < 420) return 2;
    if (screenW >= 1100) return 6;
    return 4;
  }, [screenW]);

  const tilePx = useMemo(() => {
    const available = screenW - (CONTAINER_HPADDING * 2);
    const totalGap = H_GAP * (cols - 1);
    const w = Math.floor((available - totalGap) / cols);
    return Math.max(100, w);
  }, [screenW, cols]);

  const plantOfDay = useMemo(() => {
    const plants = [
      { name: "Basil",     tip: "Pinch tops to keep it bushy; avoid flowering.", icon: "🌿" },
      { name: "Tomato",    tip: "Water deeply; mulch to prevent splash.",        icon: "🍅" },
      { name: "Lavender",  tip: "Full sun, sharp drainage; trim after blooms.",  icon: "💜" },
      { name: "Mint",      tip: "Grow in containers to limit spread.",           icon: "🌱" },
      { name: "Strawberry",tip: "Remove runners for bigger berries.",            icon: "🍓" },
      { name: "Rosemary",  tip: "Let soil dry slightly between waterings.",      icon: "🌿" },
      { name: "Marigold",  tip: "Deadhead to extend blooms & deter pests.",      icon: "🌼" },
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
      resizeMode="cover"
      style={{ flex: 1, width: "100%", height: "100%" }}
      imageStyle={{ opacity: 0.85 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* ===== Top strip: compact, useful, dynamic ===== */}
        <View style={styles.topStrip}>
          <Text style={styles.topStripGreeting}>{greeting}, {displayName} 👋</Text>
          <Text style={styles.topStripTag}>{seasonTag}</Text>
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

        {/* ====== Compact grid (everything lives here) ====== */}
        <View style={styles.grid}>
          {/* Today — seed packet */}
          <View style={[styles.tile, { width: tilePx }]}>
            <SeedPacket
              title="Today"
              subtitle="Tasks & Notes"
              variant="rose"
              footer={tasks?.length ? `${tasks.length} task${tasks.length>1?"s":""} today` : "All caught up?"}
              onPress={() => router.push("/(tabs)/tasks")}
            >
              <View style={{ gap: 6 }}>
                {/* Quick Add */}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TextInput
                    value={quickNote}
                    onChangeText={setQuickNote}
                    placeholder="Quick add…"
                    placeholderTextColor="#9c8f86"
                    style={styles.inputSm}
                  />
                  <Pressable onPress={quickAddToday} style={styles.btnPrimarySm}>
                    <Text style={styles.btnPrimaryTxtSm}>Add</Text>
                  </Pressable>
                </View>

                {/* Tiny list preview (max 2) */}
                {tasks === null ? (
                  <Text style={styles.cardSub}>Loading…</Text>
                ) : tasks.length === 0 ? (
                  <Text style={styles.cardSub}>You’re all caught up. 🌤️</Text>
                ) : (
                  <>
                    {tasks.slice(0,2).map((t) => (
                      <Pressable key={t.id} onPress={() => toggleTask(t.id, t.done)} style={styles.taskRowMini}>
                        <View style={[styles.checkboxMini, t.done && styles.checkboxOn]} />
                        <Text style={styles.taskMiniText} numberOfLines={1}>
                          {(t.type?.toUpperCase?.() || "TASK") + (t.notes ? ` · ${t.notes}` : "")}
                        </Text>
                      </Pressable>
                    ))}
                    {tasks.length > 2 && (
                      <Pressable onPress={() => router.push("/(tabs)/tasks")}>
                        <Text style={styles.linkTiny}>View all ({tasks.length})</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            </SeedPacket>
          </View>

          {/* Weather + Frost — seed packet */}
          <View style={[styles.tile, { width: tilePx }]}>
            <SeedPacket
              title="Weather & Frost"
              subtitle="Today’s snapshot"
              variant="green"
              footer={`Low ${numOrDash(minToday, "°F")} • High ${numOrDash(maxToday, "°F")}`}
            >
              <View style={styles.wxRowCompact}>
                <WxStat label="Low" value={numOrDash(minToday, "°F")} compact />
                <VLine />
                <WxStat label="High" value={numOrDash(maxToday, "°F")} compact />
                <VLine />
                <WxStat label="Precip" value={precipOrDash(precipToday)} compact />
              </View>
              <View style={styles.frostRowCompact}>
                <FrostPill level={frostOutlook.level} />
                <Text style={[styles.cardSub, styles.frostMsg]} numberOfLines={2}>
                  {frostOutlook.msg}
                </Text>
              </View>
            </SeedPacket>
          </View>

          {/* Your Garden — now shows user's beds */}
          <View style={[styles.tile, { width: tilePx }]}>
            <SeedPacket
              title="Your Garden"
              subtitle="Beds & Plants"
              variant="gold"
              footer={`${beds?.length ?? 0} bed${(beds?.length ?? 0) === 1 ? "" : "s"}`}
            >
              {/* Buttons row */}
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <Pressable
                  style={[styles.btnSeed, styles.btnSeedPrimary]}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  onPress={() => router.push("/(tabs)/plants")}
                >
                  <Text style={[styles.btnSeedTxt, styles.btnSeedTxtPrimary]}>Open Beds</Text>
                </Pressable>

                <Pressable
                  style={[styles.btnSeed, styles.btnSeedHollow]}
                  android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                  onPress={() => router.push("/(tabs)/plants?focus=new")}
                >
                  <Text style={[styles.btnSeedTxt, styles.btnSeedTxtHollow]}>Add Bed</Text>
                </Pressable>
              </View>

              {/* Bed tags */}
              {beds === null ? (
                <Text style={styles.cardSub}>Loading beds…</Text>
              ) : beds.length === 0 ? (
                <Text style={styles.cardSub}>No beds yet. Add one to get started.</Text>
              ) : (
                <>
                  <View style={styles.bedTagGrid}>
                    {beds.slice(0, 6).map((b) => (
                      <Pressable
                        key={b.id}
                        style={styles.bedTag}
                        onPress={() => router.push("/(tabs)/plants")}
                        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                      >
                        <Text style={styles.bedTagTxt} numberOfLines={1}>
                          {b.name || b.title || "Unnamed bed"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {beds.length > 6 && (
                    <Pressable onPress={() => router.push("/(tabs)/plants")}>
                      <Text style={styles.linkTiny}>View all beds ({beds.length})</Text>
                    </Pressable>
                  )}
                </>
              )}
            </SeedPacket>
          </View>

          {/* Watering Radar — seed packet (placeholder) */}
          <View style={[styles.tile, { width: tilePx }]}>
            <SeedPacket
              title="Watering Radar"
              subtitle="Schedules at a glance"
              variant="green"
              footer="Connect schedules to power this"
            >
              <View>
                <View style={styles.badgeGrid}>
                  <StatusBadge tone="due">Bed A — Tomatoes</StatusBadge>
                  <StatusBadge tone="soon">Herbs — Pots</StatusBadge>
                  <StatusBadge tone="ok">North Bed — Peppers</StatusBadge>
                </View>
              </View>
            </SeedPacket>
          </View>

          {/* Plant of the Day — seed packet */}
          <View style={[styles.tile, { width: tilePx }]}>
            <SeedPacket
              title="Plant of the Day"
              subtitle={plantOfDay?.name ?? "—"}
              variant="rose"
              footer="Tip of the day"
            >
              <View style={styles.podRow}>
                <Text style={styles.podIcon}>{plantOfDay?.icon ?? "🌿"}</Text>
                <Text style={styles.cardSub} numberOfLines={3}>
                  {plantOfDay?.tip ?? "Daily growing tip appears here."}
                </Text>
              </View>
            </SeedPacket>
          </View>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </ImageBackground>
  );
}

/* Small components */
const WxStat = ({ label, value, compact = false }) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Text style={[styles.wxLabel, compact && styles.wxLabelCompact]}>{label}</Text>
    <Text style={[styles.wxValue, compact && styles.wxValueCompact]}>{value}</Text>
  </View>
);
const VLine = () => <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 6, alignSelf: "stretch" }} />;

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
  container: { padding: 12, gap: 12, backgroundColor: "transparent" },

  // Dynamic top strip (replaces big hero)
  topStrip: {
    backgroundColor: C.bgAlt,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
  },
  topStripGreeting: { fontSize: 16, fontWeight: "800", color: C.text },
  topStripTag: { color: C.sub, marginTop: 2, fontSize: 12 },

  // OVERDUE STRIP
  overdueStrip: {
    backgroundColor: C.terracottaLight,
    borderWidth: 1,
    borderColor: C.terracotta,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  overdueText: { color: C.text, fontWeight: "700", fontSize: 13 },

  // CARDS / TEXT
  cardTitle: { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 4 },
  cardSub: { color: C.sub, fontSize: 12 },
  cardHint: { color: C.sub, fontSize: 11, marginTop: 6 },

  inputSm: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6,
    color: C.text,
    fontSize: 13,
  },
  btnPrimarySm: {
    backgroundColor: "#A26769",
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  btnPrimaryTxtSm: { color: "white", fontWeight: "700", fontSize: 12 },

  // WEATHER (compact)
  wxRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingVertical: 6, paddingHorizontal: 8, marginTop: 4,
  },
  wxLabel: { color: C.sub, fontSize: 11 },
  wxValue: { color: C.text, fontSize: 16, fontWeight: "700", marginTop: 2 },
  wxLabelCompact: { fontSize: 10 },
  wxValueCompact: { fontSize: 15 },

  // BADGES
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  badge: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: C.border },
  badgeText: { fontSize: 12, fontWeight: "600" },

  // FROST (compact)
  frostRowCompact: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
  frostPill: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border },
  frostPillText: { fontWeight: "700", fontSize: 12 },
  frostMsg: { flex: 1, fontSize: 12 },

  // MINI task list
  taskRowMini: {
    flexDirection: "row", alignItems: "center",
    gap: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  checkboxMini: {
    width: 14, height: 14, borderRadius: 3,
    borderWidth: 2, borderColor: C.sub, backgroundColor: "transparent",
  },
  checkboxOn: { backgroundColor: "#7BA47E", borderColor: "#7BA47E" },
  taskMiniText: { color: C.text, fontSize: 13, flex: 1 },
  linkTiny: { color: "#A26769", fontWeight: "700", marginTop: 6, fontSize: 12 },

  // POD
  podRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  podIcon: { fontSize: 30 },
  podName: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 2 },

  // GRID LAYOUT — evenly spaced columns
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginTop: 6,
  },
  tile: {
    aspectRatio: 0.65, // tall & narrow like seed packets
    minHeight: 130,
  },
  tileContent: {
    minHeight: 90,
    justifyContent: "space-between",
  },

  // Seed-tag buttons
  btnSeed: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  btnSeedPrimary: { backgroundColor: C.terracotta, borderColor: "#8F6F52" },
  btnSeedHollow: { backgroundColor: "#FFF8ED", borderColor: "#D2BDA6" },
  btnSeedTxt: { fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },
  btnSeedTxtPrimary: { color: C.white },
  btnSeedTxtHollow: { color: C.text },

  // Bed tags
  bedTagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bedTag: {
    backgroundColor: C.white,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    maxWidth: "100%",
  },
  bedTagTxt: { color: C.text, fontWeight: "700", fontSize: 12, maxWidth: 180 },
});
