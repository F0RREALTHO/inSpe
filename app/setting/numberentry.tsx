import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { useTheme } from "../context/ThemeContext";

import { AnimatedNumberDisplay } from "../../components/AnimatedInput/AnimatedNumberDisplay";
import { InputButton } from "../../components/AnimatedInput/InputButton";

const { width } = Dimensions.get("window");
const KEY_SIZE = (width - 60) / 3;

export default function NumberEntrySettings() {
  const router = useRouter();
  const { theme } = useTheme();

  const [activeType, setActiveType] = useState<"type1" | "type2">("type1");
  const [value, setValue] = useState("");
  const [hapticStyle, setHapticStyle] = useState<string>("Subtle");

  useEffect(() => {
    const loadPref = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.numberEntry) setActiveType(data.numberEntry);
          if (data.haptics) setHapticStyle(data.haptics);
        }
      }
    };
    loadPref();
  }, []);

  const getDisplayValue = () => {
    if (activeType === "type1") {
      if (!value) return "0.00";
      const num = parseInt(value, 10);
      return (num / 100).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      if (!value) return "0";
      const [intPart, decPart] = value.split('.');
      const formattedInt = parseInt(intPart || "0", 10).toLocaleString('en-IN');
      return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
    }
  };

  const triggerHaptic = (type: 'number' | 'action') => {
    if (hapticStyle === "None") return;

    if (hapticStyle === "Excessive") {
      if (type === 'number') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    else if (hapticStyle === "Subtle") {
      if (type === 'action') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handlePress = (key: string) => {
    if (key === "backspace") {
      triggerHaptic('action');
      setValue((prev) => prev.slice(0, -1));
      return;
    }
    const currentDigits = value.replace('.', '');
    if (currentDigits.length >= 8) return;

    if (key === ".") {
      triggerHaptic('number');
      if (activeType === "type1") return;
      if (value.includes(".")) return;
      setValue((prev) => prev + ".");
      return;
    }
    triggerHaptic('number');
    if (activeType === "type1") {
      setValue((prev) => prev + key);
    } else {
      if (value === "0" && key !== ".") setValue(key);
      else setValue((prev) => prev + key);
    }
  };

  const handleSave = async () => {
    triggerHaptic('action');
    setValue("");

    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), { numberEntry: activeType });
        setTimeout(() => router.back(), 150);
      }
    } catch (e) {
      Alert.alert("Error", "Could not save setting");
    }
  };

  const renderGridItem = (label: string, val: string) => (
    <View style={styles.keyWrapper}>
      <InputButton
        label={label}
        onPress={() => handlePress(val)}
        style={{ backgroundColor: theme.card }}
        textStyle={{ color: theme.text }}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: theme.card }]}
        >
          <Ionicons name="chevron-back" size={24} color={theme.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Number Entry Method</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>

        <View style={[styles.toggleContainer, { backgroundColor: theme.card }]}>
          <Pressable
            onPress={() => { setActiveType("type1"); setValue(""); }}
            style={[styles.toggleBtn, activeType === "type1" && { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.toggleText, { color: activeType === "type1" ? "#fff" : theme.muted }]}>Type 1</Text>
          </Pressable>
          <Pressable
            onPress={() => { setActiveType("type2"); setValue(""); }}
            style={[styles.toggleBtn, activeType === "type2" && { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.toggleText, { color: activeType === "type2" ? "#fff" : theme.muted }]}>Type 2</Text>
          </Pressable>
        </View>

        <View style={styles.infoBox}>
          <Text style={[styles.infoTitle, { color: theme.text }]}>
            {activeType === "type1" ? '"Pre-dotted"' : '"Cent-less"'}
          </Text>
          <Text style={[styles.infoSub, { color: theme.muted }]}>
            {activeType === "type1"
              ? "If you're too lazy to add a decimal point, I gotchu covered."
              : "If your transactions usually amount to whole numbers - this one is for you."}
          </Text>
        </View>

        <View style={styles.displayContainer}>
          <Text style={[styles.currencySymbol, { color: theme.muted }]}>₹</Text>

          <View style={{ height: 80, justifyContent: 'center' }}>
            <AnimatedNumberDisplay
              value={getDisplayValue()}
              style={[styles.amount, { color: theme.text }]}
            />
          </View>

          {value.length > 0 && (
            <TouchableOpacity onPress={() => setValue("")} style={[styles.clearBtn, { backgroundColor: theme.card }]}>
              <Ionicons name="close" size={14} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.keypad}>
          <View style={styles.row}>
            {renderGridItem("1", "1")}
            {renderGridItem("2", "2")}
            {renderGridItem("3", "3")}
          </View>
          <View style={styles.row}>
            {renderGridItem("4", "4")}
            {renderGridItem("5", "5")}
            {renderGridItem("6", "6")}
          </View>
          <View style={styles.row}>
            {renderGridItem("7", "7")}
            {renderGridItem("8", "8")}
            {renderGridItem("9", "9")}
          </View>
          <View style={styles.row}>
            {activeType === "type1" ? (
              <View style={styles.keyWrapper}>
                <InputButton
                  label="backspace"
                  onPress={() => handlePress("backspace")}
                  style={{ backgroundColor: theme.card }}
                  textStyle={{ color: theme.text }}
                />
              </View>
            ) : (
              renderGridItem(".", ".")
            )}

            {renderGridItem("0", "0")}

            <View style={styles.keyWrapper}>
              <InputButton
                label="check"
                onPress={handleSave}
                style={{ backgroundColor: theme.accent }}
                textStyle={{ color: '#fff' }}
              />
            </View>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  content: { flex: 1, alignItems: "center", paddingTop: 20 },
  toggleContainer: { flexDirection: "row", borderRadius: 25, padding: 4, marginBottom: 20 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 24, borderRadius: 20 },
  toggleText: { fontWeight: "600", fontSize: 15 },
  infoBox: { alignItems: "center", paddingHorizontal: 40, marginBottom: 20 },
  infoTitle: { fontSize: 22, fontWeight: "700", marginBottom: 10 },
  infoSub: { textAlign: "center", fontSize: 14, lineHeight: 20 },

  displayContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    height: 100,
    width: '100%',
  },
  currencySymbol: { fontSize: 32, marginRight: 8, fontWeight: "600", paddingBottom: 10 },
  amount: { fontSize: 56, fontWeight: "400", fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto' },

  clearBtn: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center", marginLeft: 15 },

  keypad: { width: "100%", paddingHorizontal: 20, gap: 15 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  keyWrapper: { width: KEY_SIZE, height: 75 },
});