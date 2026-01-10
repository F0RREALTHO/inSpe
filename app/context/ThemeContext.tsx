import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../../firebaseConfig";
import { getTheme } from "../components/themes";

type ThemeContextType = {
  dark: boolean;
  toggleTheme: () => void;
  theme: ReturnType<typeof getTheme>;
  ready: boolean; 
};

const STORAGE_KEY = "@inspend_theme";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [dark, setDark] = useState<boolean>(true); 
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && s) {
          setDark(s === "dark");
          setReady(true);
          return;
        }

        const user = auth.currentUser;
        if (user) {
          try {
            const docRef = doc(db, "users", user.uid);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              const data = snap.data();
              if (mounted && data?.theme) {
                setDark(data.theme === "dark");
                setReady(true);
                return;
              }
            }
          } catch (e) {
            console.warn("Theme load firestore:", e);
          }
        }

        if (mounted) setDark(true);
      } catch (err) {
        console.warn("Theme load error:", err);
        if (mounted) setDark(true);
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready) return; 
    AsyncStorage.setItem(STORAGE_KEY, dark ? "dark" : "light").catch((e) =>
      console.warn("Theme save failed:", e)
    );
  }, [dark, ready]);

  const toggleTheme = () => setDark((d) => !d);

  const theme = getTheme(dark);

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ dark, toggleTheme, theme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
