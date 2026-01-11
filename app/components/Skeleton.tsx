import { useEffect, useRef } from 'react';
import { Animated, DimensionValue } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SkeletonProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: any;
}

export default function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const { theme, dark } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
  }, []);

  const bg = dark ? theme.border : 'rgba(0,0,0,0.08)';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: bg,
          opacity,
        },
        style,
      ]}
    />
  );
}