// app/(tabs)/_layout.js
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // keep headers hidden on tab roots
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
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />

      {/* Point the tab at the folder, not the file */}
      <Tabs.Screen
        name="plants"
        options={{
          tabBarLabel: "Plants",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "leaf" : "leaf-outline"}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="planner/index"
        options={{
          tabBarLabel: "Planner",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal/index"
        options={{
          tabBarLabel: "Journal",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "book" : "book-outline"}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          tabBarLabel: "Tasks",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "checkmark-done" : "checkmark-done-outline"}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
