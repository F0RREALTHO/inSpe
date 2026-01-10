// app/components/TimeOfDayBadge.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
  theme: {
    bg: string;
    text: string;
    muted: string;
    card: string;
    cardText?: string;
    cardLight?: string;
    cardShadow?: string;
    accent?: string;
    progressBg?: string;
    progressFill?: string;
    tinyBg?: string;
    border?: string;
  };
};

export default function TimeOfDayBadge({ theme }: Props): JSX.Element {
  const hour = new Date().getHours();
  let emoji = "🌞";
  let label = "Morning";

  if (hour < 12) {
    emoji = "🌤️";
    label = "Morning";
  } else if (hour < 18) {
    emoji = "🌞";
    label = "Afternoon";
  } else if (hour < 20) {
    emoji = "🌇";
    label = "Evening";
  } else {
    emoji = "🌙";
    label = "Night";
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border || "transparent" }]}>
      <Text style={[styles.emoji]}>{emoji}</Text>
      <View style={{ marginLeft: 8 }}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.small, { color: theme.muted }]}>It’s {label.toLowerCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emoji: { fontSize: 20 },
  label: { fontWeight: "800", fontSize: 12 },
  small: { fontSize: 11 },
});
