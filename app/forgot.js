import React, { useContext, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { AuthContext } from '../contexts/AuthContext';

const C = {
  text: '#4a3f35', sub: '#6b5a50', border: '#e5dcc9', white: '#fff', primary: '#A26769'
};

export default function Forgot() {
  const { resetPassword } = useContext(AuthContext);
  const [email, setEmail] = useState('');

  async function onReset() {
    try {
      if (!email) return Alert.alert('Missing email', 'Enter your email.');
      await resetPassword(email.trim());
      Alert.alert('Check your inbox', 'Password reset email sent.');
    } catch (e) {
      let msg = 'Could not send reset email.';
      if (e?.code === 'auth/user-not-found') msg = 'No account found for that email.';
      if (e?.code === 'auth/invalid-email') msg = 'Enter a valid email.';
      Alert.alert('Reset failed', msg);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.wrap}>
        <Text style={s.title}>Forgot Password</Text>

        <Text style={s.label}>Email</Text>
        <TextInput style={s.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9c8f86" />

        <Pressable onPress={onReset} style={s.button}><Text style={s.buttonTxt}>Send Reset Link</Text></Pressable>

        <View style={{ marginTop: 12 }}>
          <Link href="/login"><Text style={s.link}>Back to Sign In</Text></Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: '800', color: C.text, marginBottom: 12 },
  label: { color: C.sub, marginTop: 8 },
  input: { borderWidth: 1, borderColor: C.border, backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.text },
  button: { backgroundColor: C.primary, marginTop: 16, paddingVertical: 12, borderRadius: 10 },
  buttonTxt: { color: 'white', fontWeight: '700', textAlign: 'center' },
  link: { color: C.primary, fontWeight: '700' },
});
