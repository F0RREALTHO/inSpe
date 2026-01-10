import { createAnimatedPressable } from 'pressto';
import { interpolate } from 'react-native-reanimated';
import { StyleSheet, Text, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputButtonProps {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedPressable = createAnimatedPressable((progress) => {
  'worklet';
  const scale = interpolate(progress, [0, 1], [1, 0.9]);
  const opacity = interpolate(progress, [0, 1], [1, 0.8]);

  return {
    transform: [{ scale }],
    opacity,
  };
});

export const InputButton: React.FC<InputButtonProps> = ({ label, onPress, style, textStyle }) => {
  return (
    <AnimatedPressable onPress={onPress} style={[styles.container, style]}>
      {label === 'backspace' ? (
        <Ionicons name="backspace" size={24} color={textStyle?.color} />
      ) : label === 'check' ? (
        <Ionicons name="checkmark" size={28} color="#fff" />
      ) : (
        <Text style={[styles.text, textStyle]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    height: '100%',
    width: '100%',
  },
  text: {
    fontSize: 28,
    fontWeight: '500',
  },
});