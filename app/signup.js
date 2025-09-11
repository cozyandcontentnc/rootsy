import React, { useContext, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { AuthContext } from '../contexts/AuthContext';

const C = {
  text: '#4a3f35', sub: '#6b5a50', border: '#e5dcc9', white: '#fff', primary: '#A26769'
};

export default function SignUp() {
  const { signUp } = useContext(AuthContext);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSignUp() {
    try {
      if (!email || !password) return Alert.alert('Missing info', 'Enter email and password.');
      await signUp(email.trim(), password, displayName.trim());
    } catch (e) {
      let msg = 'Could not create account.';
      if (e?.code === 'auth/email-already-in-use') msg = 'That email is already in use.';
      if (e?.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      if (e?.code === 'auth/invalid-email') msg = 'Enter a valid email.';
      Alert.alert('Sign up failed', msg);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.wrap}>
        <Text style={s.title}>Create Account</Text>

        <Text style={s.label}>Display Name (optional)</Text>
        <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="Jane Doe" placeholderTextColor="#9c8f86" />

        <Text style={s.label}>Email</Text>
        <TextInput style={s.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9c8f86" />

        <Text style={s.label}>Password</Text>
        <TextInput style={s.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#9c8f86" />

        <Pressable onPress={onSignUp} style={s.button}><Text style={s.buttonTxt}>Sign Up</Text></Pressable>

        <View style={{ marginTop: 12 }}>
          <Link href="/login"><Text style={s.link}>Already have an account? Sign in</Text></Link>
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
