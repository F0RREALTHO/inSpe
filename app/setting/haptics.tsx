import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { useTheme } from "../context/ThemeContext";

const OPTIONS = ["None", "Subtle", "Excessive"];

export default function HapticsSettings() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string>("Subtle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().haptics) {
          setSelected(snap.data().haptics);
        }
      }
      setLoading(false);
    };
    loadSettings();
  }, []);

  const handleSelect = async (option: string) => {
    if (option !== "None") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSelected(option);
    
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, "users", user.uid), { haptics: option });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      
      <View style={styles.header}>
        <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.roundBtn, { backgroundColor: theme.card }]}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Haptic Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {loading ? (
            <ActivityIndicator size="small" color={theme.accent} />
        ) : (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
            {OPTIONS.map((opt, index) => {
                const active = selected === opt;
                return (
                <TouchableOpacity
                    key={opt}
                    onPress={() => handleSelect(opt)}
                    style={[
                    styles.row,
                    index !== OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.bg }
                    ]}
                >
                    <Text style={[styles.label, { color: theme.text }]}>{opt}</Text>
                    {active && <Ionicons name="checkmark" size={20} color={theme.text} />}
                </TouchableOpacity>
                );
            })}
            </View>
        )}

        <Text style={styles.helperText}>
          The 'Excessive' mode makes the entire numpad haptic. 'Subtle' only vibrates on completion.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  roundBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  label: { fontSize: 16, fontWeight: "500" },
  helperText: { marginTop: 15, color: "#6b7280", fontSize: 13, lineHeight: 20, paddingHorizontal: 10 }
});