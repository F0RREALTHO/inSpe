import { useEffect } from 'react';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Text, StyleSheet, TextStyle } from 'react-native';

interface AnimatedSingleNumberProps {
  value: string;
  index: number;
  style?: TextStyle | TextStyle[];
}

export const AnimatedSingleNumber: React.FC<AnimatedSingleNumberProps> = ({ value, index, style }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 150 });
  }, []);

  const rStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View 
      layout={LinearTransition.springify().damping(20).stiffness(200)} 
      entering={FadeIn.duration(100)}
      exiting={FadeOut.duration(100)}
      style={[styles.container]}
    >
      <Animated.View style={rStyle}>
        <Text style={style}>{value}</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 15,
  },
});