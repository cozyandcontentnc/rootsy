// app/(tabs)/plants/[slug].js
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import usePlantsCsv from "../../../src/usePlantsCsv";

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
  const { slug } = useLocalSearchParams(); // route param
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("glance");
  const scrollRef = useRef(null);

  // Load your local CSV library
  const { plants, loading, error } = usePlantsCsv();

  // Find plant by slug (primary), fallback by name-variety composite
  const plant = useMemo(() => {
    const s = String(slug || "").toLowerCase();
    if (!s || !Array.isArray(plants)) return null;
    return (
      plants.find((p) => (p.slug || "").toLowerCase() === s) ||
      plants.find(
        (p) =>
          `${(p.name || "").toLowerCase()}-${(p.variety || "")
            .toLowerCase()
            .replace(/\s+/g, "-")}` === s
      ) ||
      null
    );
  }, [slug, plants]);

  useEffect(() => {
    setActiveTab("glance");
  }, [slug]);

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
        <Text style={S.err}>Couldn’t load plants.csv</Text>
        <Text style={S.sub}>{String(error.message || error)}</Text>
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={S.pad}>
        <Text style={S.h1}>No data for this plant.</Text>
        <Text style={S.sub}>
          Make sure the URL slug matches the CSV row’s <Text style={{ fontWeight: "700" }}>slug</Text>.
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
  source: { color: "#6b5a50", marginTop: 14, fontStyle: "italic" },
});
