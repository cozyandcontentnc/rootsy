import { Platform } from "react-native";

export const cardShadow = Platform.select({
  web: { boxShadow: "0 8px 20px rgba(0,0,0,0.12)" },
  default: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});

export const smallShadow = Platform.select({
  web: { boxShadow: "0 3px 8px rgba(0,0,0,0.10)" },
  default: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
