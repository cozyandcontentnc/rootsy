// components/SeedPacket.js
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

const PALETTE = {
  kraft: "#F6EAD3",
  kraftDeep: "#E8D7B7",
  paper: "#FFFEF8",
  ink: "#3E2B1F",
  sub: "#6b5a50",
  border: "#C9B798",
  borderDark: "#AE9A79",
  green: "#8EAF8C",
  rose: "#AE8E6E",
  gold: "#D6B36A",
  white: "#FFFFFF",
};
const ACCENT = { green: PALETTE.green, rose: PALETTE.rose, gold: PALETTE.gold };

export default function SeedPacket({
  title,
  subtitle,
  variant = "green",
  onPress,
  footer,
  children,
  style,
  testID,
}) {
  const accent = ACCENT[variant] ?? ACCENT.green;
  const Container = onPress ? Pressable : View;

  return (
    <Container
      testID={testID}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "summary"}
      style={[styles.wrap, style]}
    >
      {/* Ticketed corners */}
      <View style={styles.cornerWrap}>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>ROOTSY SEEDS</Text>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.headerRow}>
          <View style={[styles.rule, { backgroundColor: accent }]} />
          <Text style={styles.ornament}>❧</Text>
          <View style={[styles.rule, { backgroundColor: accent }]} />
        </View>
        {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {/* Body fills remaining height */}
      <View style={styles.bodyFrame}>
        <View style={styles.bodyInset}>
          <View style={styles.dashedTop} />
          <View style={{ paddingTop: 6, flex: 1 }}>{children}</View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={[styles.ribbon, { backgroundColor: accent }]}>
          <Text style={styles.ribbonText} numberOfLines={1}>
            {footer ?? "Sow • Water • Harvest"}
          </Text>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: "100%",                // ⬅️ make packet fill its parent tile
    borderRadius: 16,
    backgroundColor: PALETTE.kraft,
    borderWidth: 1,
    borderColor: PALETTE.borderDark,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  /* corners */
  cornerWrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  corner: {
    position: "absolute",
    width: 12, height: 12,
    backgroundColor: PALETTE.white,
    borderWidth: 1, borderColor: PALETTE.border,
    transform: [{ rotate: "45deg" }],
  },
  tl: { top: -6, left: -6 },
  tr: { top: -6, right: -6 },
  bl: { bottom: -6, left: -6 },
  br: { bottom: -6, right: -6 },

  /* header */
  header: {
    backgroundColor: PALETTE.kraft,
    borderBottomWidth: 2, borderBottomColor: PALETTE.borderDark,
    paddingTop: 8, paddingBottom: 10, paddingHorizontal: 12,
    alignItems: "center",
  },
  brand: { color: PALETTE.ink, opacity: 0.7, fontSize: 10, letterSpacing: 1.2, fontWeight: "800" },
  headerTitle: {
    marginTop: 2, color: PALETTE.ink, fontSize: 20, fontWeight: "900",
    letterSpacing: 0.6, textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.06)", textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 },
  },
  headerRow: { marginTop: 6, width: "100%", flexDirection: "row", alignItems: "center", gap: 8 },
  rule: { flex: 1, height: 2, borderRadius: 2 },
  ornament: { color: PALETTE.sub, opacity: 0.9, fontSize: 12, textAlign: "center" },
  headerSubtitle: { marginTop: 6, color: PALETTE.sub, fontSize: 11 },

  /* body */
  bodyFrame: {
    flex: 1,                        // ⬅️ grow to make the packet tall
    backgroundColor: PALETTE.paper,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  bodyInset: {
    flex: 1,                        // ⬅️ content area also grows
    backgroundColor: PALETTE.paper,
    borderWidth: 1, borderColor: PALETTE.border,
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  dashedTop: { borderTopWidth: 1, borderColor: PALETTE.border, borderStyle: "dashed" },

  /* footer */
  footer: {
    borderTopWidth: 2, borderTopColor: PALETTE.borderDark,
    paddingVertical: 10, paddingHorizontal: 10, alignItems: "center",
    backgroundColor: PALETTE.white,
  },
  ribbon: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  ribbonText: { color: PALETTE.white, fontWeight: "800", fontSize: 11, letterSpacing: 0.3, textAlign: "center" },
});
