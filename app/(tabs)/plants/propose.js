// app/(tabs)/plants/propose.js
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { submitPlantProposal } from "../../../src/lib/plantsApi";
import { auth } from "../../../src/firebase";
import Card from "../../../components/Card";

export default function ProposePlant() {
  const { targetId } = useLocalSearchParams();
  const router = useRouter();

  const [commonName, setCommonName] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [daysToMaturity, setDaysToMaturity] = useState("");
  const [sun, setSun] = useState("");
  const [water, setWater] = useState("");
  const [soilNotes, setSoilNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    try {
      if (!auth.currentUser) {
        Alert.alert("Sign in required", "You must be signed in to submit a proposal.");
        return;
      }
      setSaving(true);
      const diff = {
        ...(commonName ? { commonName } : {}),
        ...(scientificName ? { scientificName } : {}),
        ...(daysToMaturity ? { daysToMaturity: Number(daysToMaturity) || null } : {}),
        ...(sun ? { sun } : {}),
        ...(water ? { water } : {}),
        ...(soilNotes ? { soilNotes } : {}),
      };
      if (!Object.keys(diff).length) {
        Alert.alert("Nothing to submit", "Add at least one field.");
        return;
      }
      await submitPlantProposal({ targetId: targetId ?? null, diff });
      Alert.alert("Submitted", "Thanks! Your proposal is now pending review.");
      router.back();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, backgroundColor: "#fffaf3" }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#4a3f35" }}>
        {targetId ? "Suggest an edit" : "Suggest a new plant"}
      </Text>

      {err ? <Text style={{ color: "#B3261E" }}>{err}</Text> : null}

      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Names</Text>
        <Text>Common name</Text>
        <TextInput
          placeholder="e.g., Tomato"
          value={commonName}
          onChangeText={setCommonName}
          style={{ borderWidth: 1, borderColor: "#e5dcc9", backgroundColor: "white", borderRadius: 10, padding: 10, marginBottom: 8 }}
        />
        <Text>Scientific name</Text>
        <TextInput
          placeholder="e.g., Solanum lycopersicum"
          value={scientificName}
          onChangeText={setScientificName}
          style={{ borderWidth: 1, borderColor: "#e5dcc9", backgroundColor: "white", borderRadius: 10, padding: 10 }}
        />
      </Card>

      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Basics</Text>
        <Text>Days to maturity</Text>
        <TextInput
          placeholder="e.g., 80"
          keyboardType="numeric"
          value={daysToMaturity}
          onChangeText={setDaysToMaturity}
          style={{ borderWidth: 1, borderColor: "#e5dcc9", backgroundColor: "white", borderRadius: 10, padding: 10, marginBottom: 8 }}
        />
        <Text>Sun (full / partial / shade)</Text>
        <TextInput
          placeholder="e.g., full"
          value={sun}
          onChangeText={setSun}
          style={{ borderWidth: 1, borderColor: "#e5dcc9", backgroundColor: "white", borderRadius: 10, padding: 10, marginBottom: 8 }}
        />
        <Text>Water (low / medium / high)</Text>
        <TextInput
          placeholder="e.g., medium"
          value={water}
          onChangeText={setWater}
          style={{ borderWidth: 1, borderColor: "#e5dcc9", backgroundColor: "white", borderRadius: 10, padding: 10, marginBottom: 8 }}
        />
        <Text>Soil notes</Text>
        <TextInput
          placeholder="Any extra notes"
          value={soilNotes}
          onChangeText={setSoilNotes}
          multiline
          style={{ borderWidth: 1, borderColor: "#e5dcc9", backgroundColor: "white", borderRadius: 10, padding: 10, minHeight: 80 }}
        />
      </Card>

      <Pressable
        onPress={submit}
        style={{ backgroundColor: "#A26769", padding: 12, borderRadius: 10, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>
          {saving ? "Submitting…" : "Submit proposal"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
