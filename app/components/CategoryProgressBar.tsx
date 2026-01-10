import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';

interface Segment {
  color: string;
  amount: number;
  label: string; 
  emoji: string; 
}

interface Props {
  segments: Segment[];
  totalLimit: number;
  totalSpent: number;
  theme: any;
  onPress: (segment: Segment) => void;
}

export default function CategoryProgressBar({ segments, totalLimit, totalSpent, onPress, theme }: Props) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    widthAnim.setValue(0);
    Animated.timing(widthAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, 
    }).start();
  }, [segments]);

  // If nothing spent yet, show a subtle empty track
  if (totalSpent === 0) {
      return (
        <View style={[styles.container, { backgroundColor: theme.border }]}>
            <View style={{ flex: 1, opacity: 0.1, backgroundColor: theme.text }} />
        </View>
      );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.border }]}>
      <View style={styles.barContainer}>
        {segments.map((seg, index) => {
          // ✅ FIX 1: Calculate percentage based on TOTAL SPENT, not the limit.
          // This ensures the bar is always full of color representing the breakdown.
          const rawPercent = (seg.amount / totalSpent) * 100;
          
          // ✅ FIX 2: Force a minimum width of 5% so small items are visible
          const visualWidth = Math.max(rawPercent, 5); 

          // ❌ DELETED: The line "if (widthPercent < 1) return null;" is gone.

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              onPress={() => onPress(seg)}
              style={{
                height: '100%',
                width: `${visualWidth}%`, // Use the adjusted width
                marginRight: 2, // Tiny gap between bars
              }}
            >
              <Animated.View 
                style={{
                  flex: 1,
                  backgroundColor: seg.color,
                  opacity: widthAnim,
                  borderRadius: 2
                }}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 14,
    width: '100%',
    borderRadius: 7,
    overflow: 'hidden', // Ensures bars don't overflow the rounded corners
  },
  barContainer: {
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    alignItems: 'center', // Centers bars vertically
  },
});