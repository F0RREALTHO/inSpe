import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View } from 'react-native';

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
          const rawPercent = (seg.amount / totalSpent) * 100;

          const visualWidth = Math.max(rawPercent, 5);


          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              onPress={() => onPress(seg)}
              style={{
                height: '100%',
                width: `${visualWidth}%`,
                marginRight: 2,
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
    overflow: 'hidden',
  },
  barContainer: {
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    alignItems: 'center',
  },
});