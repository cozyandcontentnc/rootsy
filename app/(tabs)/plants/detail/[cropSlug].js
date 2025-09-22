// app/(tabs)/plants/detail/[cropSlug].js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { db } from "../../../../src/firebase";
import {
  collection,
  doc as docRef,
  getDoc,
  getDocs,
  query,
  where,
  limit as qlimit,
} from "firebase/firestore";

// --- utils
const dash = (v) =>
  v === 0 ? "0" : v === null || v === undefined || v === "" ? "—" : String(v);

const joinList = (v) =>
  Array.isArray(v) ? v.filter(Boolean).join(", ") : v || null;

// MM-DD → "Apr 15"
function fmtMonthDay(mmdd) {
  if (!mmdd || typeof mmdd !== "string") return "";
  const [mm, dd] = mmdd.split("-").map((x) => parseInt(x, 10));
  if (!mm || !dd) return mmdd;
  const d = new Date(2024, mm - 1, dd);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtWindow(from, to) {
  if (!from && !to) return "—";
  if (from && !to) return fmtMonthDay(from);
  if (!from && to) return fmtMonthDay(to);
  return `${fmtMonthDay(from)} → ${fmtMonthDay(to)}`;
}

const TABS = [
  { key: "glance", label: "At a Glance" },
  { key: "sowing", label: "Sowing & Germination" },
  { key: "transplant", label: "Transplanting & Spacing" },
  { key: "growth", label: "Growth & Care" },
];

export default function PlantDetail() {
  const { cropSlug } = useLocalSearchParams(); // route param: could be a docId or a slug field
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("glance");
  const scrollRef = useRef(null);

  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setPlant(null);

    try {
      const s = String(cropSlug || "").trim();
      if (!s) throw new Error("Missing cropSlug");

      // 1) Try direct docId in publicPlants
      const direct = await getDoc(docRef(db, "publicPlants", s));
      if (direct.exists()) {
        setPlant({ id: direct.id, ...direct.data() });
        setLoading(false);
        return;
      }

      // 2) Try where('slug','==', s)
      const q1 = query(
        collection(db, "publicPlants"),
        where("slug", "==", s),
        qlimit(1)
      );
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        const d = snap1.docs[0];
        setPlant({ id: d.id, ...d.data() });
        setLoading(false);
        return;
      }

      // 3) Optional fallback — if you use a composite slug field
      //    like `${name}-${variety.toLowerCase().replace(/\s+/g,'-')}`
      const q2 = query(
        collection(db, "publicPlants"),
        where("nameVarietySlug", "==", s),
        qlimit(1)
      );
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        const d = snap2.docs[0];
        setPlant({ id: d.id, ...d.data() });
        setLoading(false);
        return;
      }

      setLoading(false);
      setPlant(null);
    } catch (e) {
      setErr(e);
      setLoading(false);
    }
  }, [cropSlug]);

  useEffect(() => {
    setActiveTab("glance");
    load();
  }, [cropSlug, load]);

  const handleTab = (key) => {
    setActiveTab(key);
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: true });
  };

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator />
        <Text style={S.sub}>Loading plant details…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={S.pad}>
        <Text style={S.err}>Couldn’t load plant</Text>
        <Text style={S.sub}>{String(error.message || error)}</Text>
        <Pressable onPress={() => router.back()} style={[S.btn, { marginTop: 12 }]}>
          <Text style={S.btnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={S.pad}>
        <Text style={S.h1}>No data for this plant.</Text>
        <Text style={S.sub}>
          We couldn’t find a <Text style={{ fontWeight: "700" }}>publicPlants</Text> document with
          this id or slug.
        </Text>
        <Pressable onPress={() => router.back()} style={[S.btn, { marginTop: 12 }]}>
          <Text style={S.btnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={S.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={S.h1}>
        {plant.name}
        {plant.variety ? ` — ${plant.variety}` : ""}
      </Text>
      {!!plant.scientificName && <Text style={S.sub}>{plant.scientificName}</Text>}
      {!!plant.imageUrl && (
        <Image source={{ uri: plant.imageUrl }} style={S.img} resizeMode="cover" />
      )}

      {/* Tabs */}
      <View style={S.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => handleTab(t.key)}
            style={[S.tab, activeTab === t.key && S.tabActive]}
          >
            <Text style={[S.tabText, activeTab === t.key && S.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* At a Glance */}
      {activeTab === "glance" && (
        <Section title="At a Glance">
          <Row label="Type" value={dash(plant.type)} />
          <Row label="Sun" value={dash(plant.sun)} />
          <Row label="Water" value={dash(plant.water)} />
          <Row label="Soil" value={dash(plant.soil)} />
          <Row
            label="Soil pH"
            value={
              plant.phMin || plant.phMax
                ? `${dash(plant.phMin)}–${dash(plant.phMax)}`
                : "—"
            }
          />
          <Row
            label="Days to maturity"
            value={
              plant.daysToMaturityMin || plant.daysToMaturityMax
                ? `${dash(plant.daysToMaturityMin)}–${dash(
                    plant.daysToMaturityMax
                  )} days`
                : "—"
            }
          />
          <Row
            label="Days to germinate"
            value={
              plant.daysToGerminateMin || plant.daysToGerminateMax
                ? `${dash(plant.daysToGerminateMin)}–${dash(
                    plant.daysToGerminateMax
                  )} days`
                : "—"
            }
          />
          {!!joinList(plant.tags) && <Row label="Tags" value={joinList(plant.tags)} />}
          {!!plant.description && <Text style={S.p}>{plant.description}</Text>}
        </Section>
      )}

      {/* Sowing & Germination */}
      {activeTab === "sowing" && (
        <Section title="Sowing & Germination">
          <Row
            label="Sow indoors"
            value={fmtWindow(plant.sowingIndoorFrom, plant.sowingIndoorTo)}
          />
          <Row
            label="Sow outdoors"
            value={fmtWindow(plant.sowingOutdoorFrom, plant.sowingOutdoorTo)}
          />
          <Row
            label="Planting depth"
            value={plant.plantingDepthIn ? `${plant.plantingDepthIn}"` : "—"}
          />
          <Row
            label="Germination"
            value={
              plant.daysToGerminateMin || plant.daysToGerminateMax
                ? `${dash(plant.daysToGerminateMin)}–${dash(
                    plant.daysToGerminateMax
                  )} days`
                : "—"
            }
          />
          {!(plant.sowingIndoorFrom || plant.sowingOutdoorFrom) &&
          !(plant.daysToGerminateMin || plant.plantingDepthIn) ? (
            <Text style={S.empty}>No sowing info available yet.</Text>
          ) : null}
        </Section>
      )}

      {/* Transplanting & Spacing */}
      {activeTab === "transplant" && (
        <Section title="Transplanting & Spacing">
          <Row
            label="Transplant window"
            value={fmtWindow(plant.transplantFrom, plant.transplantTo)}
          />
          <Row
            label="In-row spacing"
            value={plant.spacingInRowIn ? `${plant.spacingInRowIn}"` : "—"}
          />
          <Row
            label="Between rows"
            value={plant.spacingBetweenRowsIn ? `${plant.spacingBetweenRowsIn}"` : "—"}
          />
          <Row label="Frost hardiness" value={dash(plant.frostHardiness)} />
          <Row label="Height" value={plant.heightIn ? `${plant.heightIn}"` : "—"} />
          <Row label="Spread" value={plant.spreadIn ? `${plant.spreadIn}"` : "—"} />
          {!!joinList(plant.companionPlants) && (
            <Row label="Companions" value={joinList(plant.companionPlants)} />
          )}
          {!!joinList(plant.avoidPlants) && (
            <Row label="Avoid planting with" value={joinList(plant.avoidPlants)} />
          )}
        </Section>
      )}

      {/* Growth & Care */}
      {activeTab === "growth" && (
        <Section title="Growth & Care">
          {!!joinList(plant.pests) && <Row label="Common pests" value={joinList(plant.pests)} />}
          {!!joinList(plant.diseases) && (
            <Row label="Common diseases" value={joinList(plant.diseases)} />
          )}
          {!!plant.notes && <Text style={S.p}>{plant.notes}</Text>}
          {!joinList(plant.pests) && !joinList(plant.diseases) && !plant.notes ? (
            <Text style={S.empty}>No notes yet.</Text>
          ) : null}
        </Section>
      )}

      {!!plant.sourceUrl && <Text style={S.source}>Source: {plant.sourceUrl}</Text>}
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
  if (value == null) return null;
  return (
    <View style={S.row}>
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={S.rowVal}>{String(value)}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fffaf3" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  pad: { padding: 16 },
  h1: { fontSize: 22, fontWeight: "800", color: "#4a3f35" },
  sub: { color: "#6b5a50", marginTop: 4, marginBottom: 12 },
  img: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: "#fbf4eb",
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#fbf4eb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5dcc9",
    padding: 4,
    gap: 6,
    marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5dcc9" },
  tabText: { color: "#6b5a50", fontWeight: "700" },
  tabTextActive: { color: "#4a3f35" },

  section: {
    padding: 12,
    backgroundColor: "#fbf4eb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5dcc9",
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: "800", color: "#4a3f35", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 4, gap: 12 },
  rowLabel: { color: "#6b5a50", flexShrink: 0 },
  rowVal: { color: "#4a3f35", fontWeight: "600", flex: 1, textAlign: "right", flexWrap: "wrap" },
  p: { color: "#4a3f35", marginTop: 6, lineHeight: 20 },
  empty: { color: "#6b5a50", marginTop: 6 },
  err: { color: "#B3261E", fontWeight: "700", marginBottom: 8 },

  btn: {
    backgroundColor: "#ffffff",
    borderColor: "#e5dcc9",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  btnText: { color: "#4a3f35", fontWeight: "700" },

  source: { color: "#6b5a50", marginTop: 14, fontStyle: "italic" },
});
