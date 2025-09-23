// app/(tabs)/plants/_layout.js
import { Stack } from "expo-router";

export default function PlantsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
        headerTintColor: "#A26769",
        headerStyle: { backgroundColor: "#fff" },
        headerTitleStyle: { color: "#4a3f35" },
      }}
    >
      {/* Rename the header for the root Plants screen */}
      <Stack.Screen name="index" options={{ title: "Plants" }} />
    </Stack>
  );
}
