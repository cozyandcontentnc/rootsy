import { Platform } from "react-native";

export const softTextShadow = Platform.select({
  web: { textShadow: "0 2px 6px rgba(0,0,0,0.18)" },
  default: {
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
