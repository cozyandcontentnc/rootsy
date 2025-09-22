// components/PointerEventsView.js
import React from "react";
import { Platform, View } from "react-native";

/**
 * Cross-platform pointerEvents wrapper:
 * - Web: use style.pointerEvents (prop is deprecated)
 * - Native: use the real pointerEvents prop
 */
export default function PointerEventsView({ pointerEvents, style, ...rest }) {
  if (Platform.OS === "web") {
    // Only inject the style when a value is provided to avoid clobbering existing style
    const mergedStyle =
      pointerEvents != null ? [{ pointerEvents }, style] : style;
    return <View {...rest} style={mergedStyle} />;
  }
  // iOS/Android keep using the prop
  return <View {...rest} pointerEvents={pointerEvents} style={style} />;
}
