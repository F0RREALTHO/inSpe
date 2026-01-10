import React, { useRef, useEffect } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";

export default function AnimatedProgress({ percent, theme }: { percent: number; theme: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: percent, duration: 900, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  }, [percent]);

  const widthInterpolated = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View>
      <View style={[styles.progressBg, { backgroundColor: theme.progressBg }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: theme.progressFill, width: widthInterpolated }]} />
      </View>
      <Text style={[styles.progressLabel, { color: theme.muted, alignSelf: "flex-end", marginTop: 8 }]}>{percent}% used</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progressBg: { height: 12, borderRadius: 12, overflow: "hidden" },
  progressFill: { height: 12 },
  progressLabel: { marginTop: 6, fontSize: 12 },
});
