import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get("window");

export default function AnimatedTransaction({ tx, delay, theme }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: (tx.color || theme.text) + '26',
          },
        ]}
      >
        <Text style={{ fontSize: 24 }}>
          {tx.icon || "💰"}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {tx.title}
          </Text>
          <Text
            style={[
              styles.amount,
              { color: tx.type === 'expense' ? theme.text : '#22c55e' },
            ]}
          >
            {tx.amount}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.subtitle, { color: theme.muted }]}>{tx.sub}</Text>
          <Text style={[styles.date, { color: theme.muted }]}>
            {new Date(tx.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 20,
    // subtle shadow
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
  },
});