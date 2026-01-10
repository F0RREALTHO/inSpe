import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BiometricAuth from "./components/BiometricAuth";
import SmsBackgroundListener from "./components/SmsBackgroundListener";
import { DataProvider } from "./context/DataProvider"; // ✅ Import this
import { ThemeProvider } from "./context/ThemeContext";

export default function RootLayout() {
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    checkLockStatus();
  }, []);

  const checkLockStatus = async () => {
    try {
      const enabled = await AsyncStorage.getItem("biometric_enabled");
      if (enabled === "true") {
        setIsLocked(true);
      }
    } catch (e) {
      console.log("Error checking lock status", e);
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        {/* ✅ Wrap everything here so data loads in background */}
        <DataProvider> 
          {/* Background SMS listener for auto-import */}
          <SmsBackgroundListener />
          
          {isLocked ? (
            <BiometricAuth onUnlock={() => setIsLocked(false)} />
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen 
                  name="setting/numberentry" 
                  options={{ presentation: 'modal' }} 
              />
            </Stack>
          )}

        </DataProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}