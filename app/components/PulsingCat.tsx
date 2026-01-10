import React, { useRef, useEffect } from "react";
import { Animated, View, Text, StyleSheet, Easing } from "react-native";

export default function PulsingCat({ item, index, theme }: any) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    const timer = setTimeout(() => loop.start(), index * 160);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [index]);

  return (
    <Animated.View style={[styles.catCard, { transform: [{ scale: pulse }], backgroundColor: theme.card, shadowColor: theme.cardShadow }]}>
      <View style={[styles.catIcon, { backgroundColor: theme.cardLight }]} />
      <Text style={[styles.catLabel, { color: theme.text }]}>{item.label}</Text>
      <Text style={[styles.catSpent, { color: theme.cardText }]}>{item.spent}</Text>
      <View style={styles.tinyRow}>
        <View style={[styles.tinyBarBg, { backgroundColor: theme.tinyBg }]}><View style={[styles.tinyBar, { width: `${item.pct}%`, backgroundColor: theme.accent }]} /></View>
        <Text style={[styles.catPct, { color: theme.muted }]}>{item.pct}%</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  catCard: { width: 200, borderRadius: 14, padding: 16, marginRight: 12, shadowOpacity: 0.06, shadowRadius: 12 },
  catIcon: { width: 46, height: 46, borderRadius: 12, marginBottom: 12 },
  catLabel: { fontWeight: "800", fontSize: 16 },
  catSpent: { marginTop: 8, fontWeight: "800" },
  tinyRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  tinyBarBg: { flex: 1, height: 8, borderRadius: 8, overflow: "hidden", marginRight: 10 },
  tinyBar: { height: 8 },
  catPct: { width: 40, textAlign: "right" },
});
