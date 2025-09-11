// app/login.js
import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext"; // ✅ correct import

export default function Login() {
  const router = useRouter();
  const { signIn, initializing, user } = useAuth(); // ✅ use the hook
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const onSubmit = async () => {
    try {
      await signIn(email.trim(), pw);
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Login failed", String(e?.message || e));
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Login</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none"
        style={{ borderWidth: 1, marginTop: 12, padding: 10 }} />
      <TextInput placeholder="Password" value={pw} onChangeText={setPw} secureTextEntry
        style={{ borderWidth: 1, marginTop: 8, padding: 10 }} />
      <Pressable onPress={onSubmit}
        style={{ marginTop: 12, backgroundColor: "#A26769", padding: 12, borderRadius: 10 }}>
        <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>Sign in</Text>
      </Pressable>
    </View>
  );
}
