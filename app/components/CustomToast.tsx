import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onHide: () => void;
}

export default function CustomToast({ visible, message, type = 'success', onHide }: ToastProps) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const SUCCESS_COLOR = "#00F0FF";
  const ERROR_COLOR = "#FF296D";
  const INFO_COLOR = "#3b82f6";

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: Platform.OS === 'ios' ? 60 : 40,
        useNativeDriver: true,
        speed: 12,
        bounciness: 8,
      }).start();

      const timer = setTimeout(() => {
        hide();
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      hide();
    }
  }, [visible]);

  const hide = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (visible) onHide();
    });
  };

  const getToastConfig = () => {
    switch (type) {
      case 'success': return { color: SUCCESS_COLOR, icon: 'checkmark-circle' };
      case 'error': return { color: ERROR_COLOR, icon: 'alert-circle' };
      default: return { color: INFO_COLOR, icon: 'information-circle' };
    }
  };

  const config = getToastConfig();

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderLeftColor: config.color,
            shadowColor: config.color,
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 8
          }
        ]}
      >
        <Ionicons name={config.icon as any} size={24} color={config.color} style={{ marginRight: 12 }} />
        <Text style={[styles.text, { color: theme.text }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    shadowOffset: { width: 0, height: 4 },
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});