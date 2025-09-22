import { View } from "react-native";
import { smallShadow } from "../src/ui/shadows";

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
        ...require("../src/ui/shadows").smallShadow,
      }}
    >
      {children}
    </View>
  );
}
