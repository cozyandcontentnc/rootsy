import { View } from "react-native";

export default function Card({ children }) {
  return (
    <View
      style={{
        backgroundColor: "white",
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5dcc9",
        marginBottom: 8,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 6
      }}
    >
      {children}
    </View>
  );
}
