// app/planner/index.js
import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import * as Location from "expo-location";
import { Link } from "expo-router";
import { auth, db } from "../../../src/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, orderBy, query, setDoc,
  serverTimestamp, Timestamp
} from "firebase/firestore";
import { addDays, format } from "date-fns";
import Card from "../../../components/Card";

const fmt = (d) => (d instanceof Date && !isNaN(d) ? format(d, "MMM d") : "—");
const toDate = (iso) => {
  try { return new Date(`${iso}T00:00:00`); } catch { return null; }
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const yyyymmdd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Find last spring frost (≤ 0°C) from Open-Meteo archive
async function findSpringLastFrost(lat, lon, year) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${year}-01-01&end_date=${year}-06-30` +
    `&daily=temperature_2m_min&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Weather archive fetch failed");
  const j = await r.json();
  const times = j?.daily?.time || [];
  const mins = j?.daily?.temperature_2m_min || [];
  let last = null;
  for (let i = 0; i < times.length; i++) {
    if (typeof mins[i] === "number" && mins[i] <= 0) last = times[i];
  }
  return last; // "YYYY-MM-DD" or null
}

export default function Planner() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [plants, setPlants] = useState([]);
  const [frostInput, setFrostInput] = useState(""); // YYYY-MM-DD
  const [wateringCadenceDays, setWateringCadenceDays] = useState("3");
  const [wateringWeeks, setWateringWeeks] = useState("4");

  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [locErr, setLocErr] = useState("");
  const [banner, setBanner] = useState("");

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  // Load plants (from shared catalog) + settings (per-user)
  useEffect(() => {
    (async () => {
      // Always load public plants for the timeline
      const snap = await getDocs(query(collection(db, "publicPlants"), orderBy("commonName")));
      setPlants(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Load settings only if signed in
      if (!authChecked || !user) return;
      const sref = doc(db, "users", user.uid, "settings", "app");
      const sdoc = await getDoc(sref);
      const s = sdoc.exists() ? sdoc.data() : {};
      setFrostInput(typeof s.lastFrost === "string" ? s.lastFrost : "2025-04-15");
      setWateringCadenceDays(
        s.wateringCadenceDays != null ? String(s.wateringCadenceDays) : "3"
      );
      setWateringWeeks(
        s.wateringWeeks != null ? String(s.wateringWeeks) : "4"
      );
    })();
  }, [authChecked, user]);

  const lastFrost = useMemo(() => toDate(frostInput), [frostInput]);

  const saveSettings = async () => {
    if (!user) { setBanner("Sign in to save settings."); setTimeout(() => setBanner(""), 2000); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(frostInput)) return;
    const cadence = Math.max(1, parseInt(wateringCadenceDays || "3", 10) || 3);
    const weeks = Math.max(1, parseInt(wateringWeeks || "4", 10) || 4);
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid, "settings", "app"),
        { lastFrost: frostInput, wateringCadenceDays: cadence, wateringWeeks: weeks },
        { merge: true }
      );
      setBanner("Settings saved.");
      setTimeout(() => setBanner(""), 2000);
    } finally {
      setSaving(false);
    }
  };

  const useMyLocation = async () => {
    if (!user) { setBanner("Sign in to use location."); setTimeout(() => setBanner(""), 2000); return; }
    setEstimating(true);
    setLocErr("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission denied (HTTPS required on web).");
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lon } = loc.coords;

      const year = new Date().getFullYear();
      let frost = await findSpringLastFrost(lat, lon, year);
      if (!frost) frost = await findSpringLastFrost(lat, lon, year - 1);
      if (!frost) throw new Error("Could not estimate from local history.");

      setFrostInput(frost);
      await setDoc(doc(db, "users", user.uid, "settings", "app"), { lastFrost: frost }, { merge: true });
      setBanner(`Estimated last frost set to ${frost}.`);
      setTimeout(() => setBanner(""), 2500);
    } catch (e) {
      setLocErr(String(e?.message || e));
    } finally {
      setEstimating(false);
    }
  };

  const timeline = useMemo(() => {
    if (!lastFrost) return null;
    const start = addDays(lastFrost, -56); // 8w before
    const end = addDays(lastFrost, 84);    // 12w after
    const rangeMs = end - start;
    const pct = (d) => {
      if (!(d instanceof Date) || isNaN(d)) return 0;
      return clamp(((d - start) / rangeMs) * 100, 0, 100);
    };
    const widthPct = (a, b) => clamp(((b - a) / rangeMs) * 100, 0, 100);
    return { start, end, pct, widthPct };
  }, [lastFrost]);

  const rows = useMemo(() => {
    if (!lastFrost) return [];
    return plants.map((p) => {
      const startIndoors   = p.startOffsetDays != null ? addDays(lastFrost, p.startOffsetDays) : null;
      const directFrom     = p.directSowFrom != null ? addDays(lastFrost, p.directSowFrom) : null;
      const directTo       = p.directSowTo != null ? addDays(lastFrost, p.directSowTo) : null;
      const transplantFrom = p.transplantFrom != null ? addDays(lastFrost, p.transplantFrom) : null;
      const transplantTo   = p.transplantTo != null ? addDays(lastFrost, p.transplantTo) : null;

      const earliestStart = [directFrom, transplantFrom].filter(Boolean).sort((a, b) => a - b)[0];
      const harvestFrom = earliestStart && p.daysToMaturity
        ? addDays(earliestStart, p.daysToMaturity)
        : null;

      return { p, startIndoors, directFrom, directTo, transplantFrom, transplantTo, harvestFrom };
    });
  }, [plants, lastFrost]);

  // ---- Auto-create tasks (idempotent via deterministic doc IDs) ----
  async function createTasksForPlant(row) {
    if (!lastFrost) return;
    if (!user) { setBanner("Sign in to create tasks."); setTimeout(() => setBanner(""), 2000); return; }

    const slug =
      row.p.slug ||
      row.p.id ||
      row.p.commonName?.toLowerCase().replace(/\s+/g, "-") ||
      "plant";

    const tasks = [];
    if (row.startIndoors) {
      tasks.push({ type: "seed_indoors", due: row.startIndoors, notes: `Start ${row.p.commonName} indoors` });
    }
    if (row.directFrom) {
      tasks.push({ type: "direct_sow", due: row.directFrom, notes: `Direct sow ${row.p.commonName}` });
    }
    if (row.transplantFrom) {
      tasks.push({ type: "transplant", due: row.transplantFrom, notes: `Transplant ${row.p.commonName}` });
    }
    if (row.harvestFrom) {
      tasks.push({ type: "harvest", due: row.harvestFrom, notes: `Estimated first harvest: ${row.p.commonName}` });
    }

    // Watering series AFTER transplant
    const cadence = Math.max(1, parseInt(wateringCadenceDays || "3", 10) || 3);
    const weeks = Math.max(1, parseInt(wateringWeeks || "4", 10) || 4);
    if (row.transplantFrom) {
      const start = row.transplantFrom;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const totalDays = weeks * 7;
      for (let offset = 0; offset <= totalDays; offset += cadence) {
        const d = addDays(start, offset);
        if (d < today) continue; // skip past reminders
        tasks.push({ type: "water", due: d, notes: `Water ${row.p.commonName}` });
      }
    }

    let created = 0;
    for (const t of tasks) {
      const id = `${slug}-${t.type}-${yyyymmdd(t.due)}`; // deterministic → no duplicates
      await setDoc(
        doc(collection(db, "tasks"), id),
        {
          ownerId: user.uid,               // REQUIRED by rules
          type: t.type,
          notes: t.notes,
          dueAt: Timestamp.fromDate(t.due),
          done: false,
          createdAt: serverTimestamp()
        },
        { merge: true }
      );
      created++;
    }
    setBanner(`Created ${created} task${created === 1 ? "" : "s"} for ${row.p.commonName}.`);
    setTimeout(() => setBanner(""), 2500);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Seasonal Planner</Text>

      {banner ? (
        <View style={{ backgroundColor: "#e8f5e9", borderColor: "#cde7cf", borderWidth: 1, padding: 10, borderRadius: 10 }}>
          <Text style={{ color: "#2e7d32" }}>{banner}</Text>
        </View>
      ) : null}

      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Your Last Frost & Watering Preferences</Text>

        <Text style={{ fontWeight: "700" }}>Last frost (YYYY-MM-DD)</Text>
        <TextInput
          placeholder="YYYY-MM-DD"
          value={frostInput}
          onChangeText={setFrostInput}
          style={{
            backgroundColor: "white",
            borderWidth: 1, borderColor: "#e5dcc9",
            borderRadius: 10, padding: 10, marginBottom: 8
          }}
        />

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <View style={{ flexGrow: 1, minWidth: 140 }}>
            <Text style={{ fontWeight: "700" }}>Watering cadence (days)</Text>
            <TextInput
              keyboardType="numeric"
              value={wateringCadenceDays}
              onChangeText={setWateringCadenceDays}
              placeholder="3"
              style={{
                backgroundColor: "white",
                borderWidth: 1, borderColor: "#e5dcc9",
                borderRadius: 10, padding: 10, marginTop: 4
              }}
            />
          </View>
          <View style={{ flexGrow: 1, minWidth: 140 }}>
            <Text style={{ fontWeight: "700" }}>Watering duration (weeks)</Text>
            <TextInput
              keyboardType="numeric"
              value={wateringWeeks}
              onChangeText={setWateringWeeks}
              placeholder="4"
              style={{
                backgroundColor: "white",
                borderWidth: 1, borderColor: "#e5dcc9",
                borderRadius: 10, padding: 10, marginTop: 4
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Pressable
            onPress={saveSettings}
            style={{ backgroundColor: "#A26769", padding: 10, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              {saving ? "Saving..." : "Save settings"}
            </Text>
          </Pressable>

          <Pressable
            onPress={useMyLocation}
            style={{ backgroundColor: "#5b7ea1", padding: 10, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              {estimating ? "Estimating…" : "Use my location"}
            </Text>
          </Pressable>

          <Link href="/tasks">
            <View style={{ backgroundColor: "#7b8b6f", padding: 10, borderRadius: 10, alignItems: "center" }}>
              <Text style={{ color: "white", fontWeight: "700" }}>Open Tasks</Text>
            </View>
          </Link>
        </View>

        {lastFrost ? (
          <Text style={{ color: "#6b5a50", marginTop: 6 }}>
            Using last frost: {fmt(lastFrost)}
          </Text>
        ) : null}
        {locErr ? (
          <Text style={{ color: "#B3261E", marginTop: 6 }}>{locErr}</Text>
        ) : null}
        {!user ? (
          <Text style={{ color: "#6b5a50", marginTop: 6 }}>
            Tip: sign in to save settings and create tasks.
          </Text>
        ) : null}
      </Card>

      {/* Legend */}
      {timeline ? (
        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>Legend</Text>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <Legend color="#6b8e23" label="Start Indoors" />
            <Legend color="#3b7dd8" label="Direct Sow" />
            <Legend color="#e39a2d" label="Transplant" />
            <Legend color="#7b8b6f" label="Est. First Harvest" />
          </View>
          <Text style={{ color: "#6b5a50", marginTop: 8 }}>
            Windows are relative to your saved last frost date.
          </Text>
        </Card>
      ) : null}

      {/* Plant rows */}
      {rows.map((r) => (
        <Card key={r.p.slug || r.p.id}>
          <Text style={{ fontWeight: "800", marginBottom: 6 }}>{r.p.commonName}</Text>
          <Text style={{ color: "#4a3f35" }}>
            Start Indoors: {fmt(r.startIndoors)}{"  "}•{"  "}
            Direct Sow: {fmt(r.directFrom)}–{fmt(r.directTo)}{"  "}•{"  "}
            Transplant: {fmt(r.transplantFrom)}–{fmt(r.transplantTo)}{"  "}•{"  "}
            Est. First Harvest: {fmt(r.harvestFrom)}
          </Text>

          {timeline ? (
            <View style={{
              marginTop: 10, marginBottom: 8,
              backgroundColor: "#fbf4eb", borderWidth: 1, borderColor: "#e5dcc9",
              borderRadius: 10, height: 36, position: "relative", overflow: "hidden"
            }}>
              {r.startIndoors ? (
                <BarDot leftPct={timeline.pct(r.startIndoors)} color="#6b8e23" top={8} />
              ) : null}
              {r.directFrom && r.directTo ? (
                <BarRange
                  leftPct={timeline.pct(r.directFrom)}
                  widthPct={timeline.widthPct(r.directFrom, r.directTo)}
                  color="#3b7dd8"
                  top={6}
                />
              ) : null}
              {r.transplantFrom && r.transplantTo ? (
                <BarRange
                  leftPct={timeline.pct(r.transplantFrom)}
                  widthPct={timeline.widthPct(r.transplantFrom, r.transplantTo)}
                  color="#e39a2d"
                  top={20}
                />
              ) : null}
              {r.harvestFrom ? (
                <BarDot leftPct={timeline.pct(r.harvestFrom)} color="#7b8b6f" top={22} />
              ) : null}
            </View>
          ) : null}

          <Pressable
            onPress={() => createTasksForPlant(r)}
            style={{ backgroundColor: "#6b5a50", padding: 10, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              Create tasks for {r.p.commonName}
            </Text>
          </Pressable>
        </Card>
      ))}

      {rows.length === 0 ? (
        <Text style={{ color: "#6b5a50" }}>
          Add plants to your library to see seasonal windows here.
        </Text>
      ) : null}
    </ScrollView>
  );
}

/** Legend chip */
function Legend({ color, label }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text>{label}</Text>
    </View>
  );
}

/** Horizontal bar */
function BarRange({ leftPct, widthPct, color, top }) {
  return (
    <View
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        width: `${Math.max(2, widthPct)}%`,
        top,
        height: 8,
        borderRadius: 6,
        backgroundColor: color
      }}
    />
  );
}

/** Dot marker */
function BarDot({ leftPct, color, top }) {
  return (
    <View
      style={{
        position: "absolute",
        left: `calc(${leftPct}% - 5px)`,
        width: 10, height: 10, borderRadius: 6, backgroundColor: color, top
      }}
    />
  );
}
