// app/_layout.js
import { Stack } from "expo-router";
// app/_layout.js
import AuthProvider from "../contexts/AuthContext";


export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
