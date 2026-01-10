import { AntDesign } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useTheme } from '../app/context/ThemeContext';

interface CircularBlastButtonProps {
  onPress: () => void;
}

const PARTICLE_COUNT = 12;

export const CircularBlastButton: React.FC<CircularBlastButtonProps> = ({ onPress }) => {
  const { theme } = useTheme();
  
  // Animation Values
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const [showParticles, setShowParticles] = useState(false);

  // Handle Press
  const handlePress = () => {
    // 1. Button Bounce
    scale.value = withSequence(
      withSpring(0.8, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 100 })
    );

    // 2. Icon Rotation
    rotation.value = withSequence(
        withTiming(90, { duration: 150 }),
        withTiming(0, { duration: 150 })
    );

    // 3. Trigger Particles
    setShowParticles(true);
    particleProgress.value = 0;
    particleProgress.value = withTiming(1, { 
        duration: 600, 
        easing: Easing.out(Easing.quad) 
    }, (finished) => {
        if(finished) runOnJS(setShowParticles)(false);
    });

    // 4. Call actual onPress
    onPress();
  };

  const rButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const rIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* 💥 PARTICLES (Only render when needed) */}
      {showParticles && Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const angle = (i * 2 * Math.PI) / PARTICLE_COUNT;
        const radius = 60; // How far they blast

        const rParticleStyle = useAnimatedStyle(() => {
            const progress = particleProgress.value;
            const currentRadius = interpolate(progress, [0, 1], [20, radius]);
            const opacity = interpolate(progress, [0, 0.7, 1], [1, 1, 0]);
            const scaleP = interpolate(progress, [0, 1], [1, 0]);

            return {
                opacity,
                transform: [
                    { translateX: Math.cos(angle) * currentRadius },
                    { translateY: Math.sin(angle) * currentRadius },
                    { scale: scaleP }
                ]
            };
        });

        return (
            <Animated.View 
                key={i} 
                style={[
                    styles.particle, 
                    { backgroundColor: theme.accent }, 
                    rParticleStyle
                ]} 
            />
        );
      })}

      {/* 🔘 MAIN BUTTON */}
      <TouchableWithoutFeedback onPress={handlePress}>
        <Animated.View 
            style={[
                styles.button, 
                { backgroundColor: theme.text, shadowColor: theme.cardShadow }, 
                rButtonStyle
            ]}
        >
          <Animated.View style={rIconStyle}>
            <AntDesign name="plus" size={32} color={theme.bg} />
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 5,
  }
});