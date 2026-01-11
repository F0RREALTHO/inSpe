import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Platform, Animated as RNAnimated, Easing as RNEasing, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const PARTICLE_COUNT = 12;

const Particle = ({ index, progress, accent }: { index: number, progress: any, accent: string }) => {
  const angle = (index * 2 * Math.PI) / PARTICLE_COUNT;
  const radius = 90;

  const rParticleStyle = useAnimatedStyle(() => {
    const currentDist = interpolate(progress.value, [0, 1], [25, radius]);
    const opacity = interpolate(progress.value, [0, 0.7, 1], [1, 1, 0]);
    const scaleP = interpolate(progress.value, [0, 1], [1, 0]);

    return {
      opacity,
      transform: [
        { translateX: Math.cos(angle) * currentDist },
        { translateY: Math.sin(angle) * currentDist },
        { scale: scaleP }
      ]
    };
  });

  return <Animated.View style={[styles.particle, { backgroundColor: accent }, rParticleStyle]} />;
};

// --- 🔵 Pulse FAB with Morphing Icon ---
const PulseFAB = ({ onPress, accent }: { onPress: () => void, accent: string }) => {
  const scale = useRef(new RNAnimated.Value(1)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;

  const particleProgress = useSharedValue(0);
  const iconScale = useSharedValue(1);

  const [showParticles, setShowParticles] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // ✅ Track success state

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.parallel([
        RNAnimated.sequence([
          RNAnimated.timing(scale, { toValue: 1.2, duration: 2000, useNativeDriver: true, easing: RNEasing.out(RNEasing.ease) }),
          RNAnimated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true })
        ]),
        RNAnimated.sequence([
          RNAnimated.timing(opacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          RNAnimated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true })
        ])
      ])
    );
    pulse.start();
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('TRANSACTION_ADDED', () => {
      setTimeout(() => {
        triggerSuccessAnimation();
      }, 600);
    });
    return () => subscription.remove();
  }, []);

  const triggerSuccessAnimation = () => {
    iconScale.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        runOnJS(setIsSuccess)(true);

        iconScale.value = withSpring(1, { damping: 12 });

        runOnJS(setShowParticles)(true);
        particleProgress.value = 0;
        particleProgress.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }, () => {
          runOnJS(setShowParticles)(false);
        });

        runOnJS(revertToPlus)(2000);
      }
    });
  };

  const revertToPlus = (delay: number) => {
    setTimeout(() => {
      iconScale.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) {
          runOnJS(setIsSuccess)(false);
          iconScale.value = withSpring(1);
        }
      });
    }, delay);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const rIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }]
  }));

  return (
    <View style={styles.fabContainer} pointerEvents="box-none">

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {showParticles && Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <Particle key={i} index={i} progress={particleProgress} accent={accent} />
        ))}
      </View>

      <TouchableOpacity onPress={handlePress} activeOpacity={0.9} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <RNAnimated.View style={[styles.glowRing, { backgroundColor: accent || '#7c3aed', transform: [{ scale }], opacity }]} />

        <View style={[styles.floatingBtn, { backgroundColor: isSuccess ? '#22c55e' : (accent || '#7c3aed') }]}>
          <Animated.View style={rIconStyle}>
            <Ionicons name={isSuccess ? "checkmark" : "add"} size={32} color="#fff" />
          </Animated.View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default function TabLayout() {
  const { theme, dark } = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.muted,

          tabBarStyle: {
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 25 : 20,
            left: 20,
            right: 20,
            height: 65,
            borderRadius: 35,
            borderTopWidth: 0,
            backgroundColor: 'transparent',
            ...styles.shadow,
          },

          tabBarBackground: () => (
            <View style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 35,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)',
              }
            ]}>
              <BlurView
                tint={dark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
                intensity={40}
                style={StyleSheet.absoluteFill}
              />
              <View style={[
                StyleSheet.absoluteFill,
                { backgroundColor: dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)' }
              ]} />
            </View>
          ),
        }}
      >

        <Tabs.Screen
          name="home"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconContainer, { backgroundColor: focused ? theme.accent + '20' : 'transparent', top: 12 }]}>
                <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="insights"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconContainer, {
                width: 60, height: 60, borderRadius: 30, top: -20,
                backgroundColor: theme.card,
                shadowColor: theme.accent,
                shadowOpacity: focused ? 0.4 : 0.1,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 10,
                borderWidth: 1,
                borderColor: focused ? theme.accent : 'transparent'
              }]}>
                <Ionicons name={focused ? "pie-chart" : "pie-chart-outline"} size={28} color={focused ? theme.accent : theme.muted} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconContainer, { backgroundColor: focused ? theme.accent + '20' : 'transparent', top: 12 }]}>
                <Ionicons name={focused ? "settings" : "settings-outline"} size={26} color={color} />
              </View>
            ),
          }}
        />

      </Tabs>

      <PulseFAB accent={theme.accent} onPress={() => router.push("/add")} />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: 70,
    zIndex: 20,
  },
  floatingBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
  },
  glowRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -4,
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 5,
  },
});