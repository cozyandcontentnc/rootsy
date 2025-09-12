// app/(tabs)/_layout.js
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#A26769",
        tabBarInactiveTintColor: "#856d6f",
        tabBarStyle: { height: 58, paddingTop: 6, paddingBottom: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size ?? 24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="plants/index"
        options={{
          tabBarLabel: "Plants",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "leaf" : "leaf-outline"} size={size ?? 24} color={color} />
          ),
        }}
      />

      {/* Hide Plants nested routes from the tab bar */}
      <Tabs.Screen name="plants/bed/[bedId]" options={{ href: null }} />
      <Tabs.Screen name="plants/detail/[cropSlug]" options={{ href: null }} />
      <Tabs.Screen name="plants/search/[bedId]" options={{ href: null }} />

      {/* If you don't actually use plants/[slug], remove or keep hidden */}
      <Tabs.Screen name="plants/[slug]" options={{ href: null }} />

      <Tabs.Screen
        name="planner/index"
        options={{
          tabBarLabel: "Planner",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal/index"
        options={{
          tabBarLabel: "Journal",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "book" : "book-outline"} size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          tabBarLabel: "Tasks",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "checkmark-done" : "checkmark-done-outline"} size={size ?? 24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
