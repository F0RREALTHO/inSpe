import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function BiometricAuth({ onUnlock }: { onUnlock: () => void }) {
  const { theme, dark } = useTheme();
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
      authenticate();
    })();
  }, []);

  const authenticate = async () => {
    try {
      const hasRecords = await LocalAuthentication.isEnrolledAsync();

      if (!hasRecords) {
        onUnlock();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock InSpend',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onUnlock();
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={[styles.iconBox, { backgroundColor: theme.card }]}>
          <Ionicons name={dark ? "lock-closed" : "lock-closed-outline"} size={48} color={theme.accent} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>InSpend is Locked</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Authenticate to access your finances.</Text>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.accent }]}
          onPress={authenticate}
          activeOpacity={0.8}
        >
          <Ionicons name="finger-print-outline" size={24} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.btnText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
  },
  btn: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  btnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});