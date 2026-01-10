import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { useTheme } from "../context/ThemeContext";

const STORAGE_THEME_KEY = "@inspend_theme";

export default function ThemeSettings(): JSX.Element {
  const { theme, dark, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const applyTheme = async (mode: "light" | "dark") => {
    setLoading(true);
    try {
      if (mode === "dark" && !dark) toggleTheme();
      if (mode === "light" && dark) toggleTheme();

      await AsyncStorage.setItem(STORAGE_THEME_KEY, mode);

      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), { theme: mode }, { merge: true });
      }

      setTimeout(() => {
        setLoading(false);
        router.back();
      }, 300);
    } catch (e) {
      console.log("Theme save error:", e);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      
      {/* 1. Custom Header for Consistency */}
      <View style={styles.header}>
        <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.roundBtn, { backgroundColor: theme.card }]}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        >
          <Ionicons name="chevron-back" size={24} color={theme.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Appearance</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: 20 }}>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Choose how InSpend looks</Text>

        <View style={{ height: 20 }} />

        {/* LIGHT MODE OPTION */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.option, 
            { 
                backgroundColor: !dark ? theme.accent : theme.card,
                borderColor: !dark ? theme.accent : theme.border,
                // Glow effect for active item
                shadowColor: !dark ? theme.accent : "#000",
                shadowOpacity: !dark ? 0.4 : 0,
                shadowRadius: 10,
                elevation: !dark ? 5 : 0
            }
          ]}
          onPress={() => applyTheme("light")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="sunny" size={20} color={!dark ? "#fff" : theme.text} />
            <Text style={{ color: !dark ? "#fff" : theme.text, fontWeight: "700", fontSize: 16 }}>Light Mode</Text>
          </View>
          {!dark && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
        </TouchableOpacity>

        {/* DARK MODE OPTION */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.option, 
            { 
                backgroundColor: dark ? theme.accent : theme.card, 
                marginTop: 16,
                borderColor: dark ? theme.accent : theme.border,
                // Glow effect for active item
                shadowColor: dark ? theme.accent : "#000",
                shadowOpacity: dark ? 0.4 : 0,
                shadowRadius: 10,
                elevation: dark ? 5 : 0
            }
          ]}
          onPress={() => applyTheme("dark")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="moon" size={20} color={dark ? "#fff" : theme.text} />
            <Text style={{ color: dark ? "#fff" : theme.text, fontWeight: "700", fontSize: 16 }}>Dark Mode</Text>
          </View>
          {dark && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
        </TouchableOpacity>

        {loading && <ActivityIndicator style={{ marginTop: 30 }} size="large" color={theme.accent} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  roundBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: 'center' },
  
  subtitle: { marginTop: 0, fontSize: 14, paddingHorizontal: 4 },
  option: {
    padding: 18,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },
});