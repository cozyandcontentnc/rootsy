import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { LogBox, Platform } from "react-native";

// Silence noisy third-party cycles (you can widen/narrow this list)
LogBox.ignoreLogs([
  /Require cycle: .*@grpc\/grpc-js/,
  /Require cycle: .*protobufjs/,
]);

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
