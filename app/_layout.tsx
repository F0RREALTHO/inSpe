import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from "../firebaseConfig";

import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import AuthProtection from "./components/AuthProtection";
import BiometricAuth from "./components/BiometricAuth";
import SmsBackgroundListener from "./components/SmsBackgroundListener";
import { DataProvider } from "./context/DataProvider";
import { ThemeProvider } from "./context/ThemeContext";
import { resetSmsCache } from "./utils/SmsService";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [appReady, setAppReady] = useState(false);

  const router = useRouter();
  const segments = useSegments();


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const bioEnabled = await AsyncStorage.getItem("biometric_enabled");
          if (bioEnabled === "true") {
            setIsLocked(true);
          }
        } catch (e) {
          console.log("Biometric check error", e);
        }
      } else {
        setIsLocked(false);
        resetSmsCache(); // ✅ Clear cached SMS IDs on logout
      }

      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, []);


  useEffect(() => {
    if (!initializing && appReady) {
      SplashScreen.hideAsync();
    }
  }, [initializing, appReady]);

  if (initializing) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <DataProvider>
          <ActionSheetProvider>
            <>
              <SmsBackgroundListener />
              <AuthProtection onReady={() => setAppReady(true)} />

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
            </>
          </ActionSheetProvider>
        </DataProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}