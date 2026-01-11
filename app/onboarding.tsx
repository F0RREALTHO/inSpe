import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";
import { useTheme } from "./context/ThemeContext";

import { NotificationService } from "./utils/NotificationService";

const STORAGE_THEME_KEY = "@inspend_theme";
const STORAGE_NAME_KEY = "@inspend_name";

const formatNumber = (n: number | string) => {
  const digits = Number(String(n).replace(/[^0-9]/g, "")) || 0;
  try {
    return new Intl.NumberFormat("en-IN").format(digits);
  } catch {
    return digits.toString();
  }
};

const stripDigits = (s: string | undefined) => (s ? s.replace(/[^0-9]/g, "") : "");

const ONBOARDING_CATEGORIES = [
  { id: '1', emoji: '🍔', label: 'Food', color: '#3b82f6', isCustom: false },
  { id: '2', emoji: '🚆', label: 'Transport', color: '#64748b', isCustom: false },
  { id: '3', emoji: '🏠', label: 'Rent', color: '#f59e0b', isCustom: false },
  { id: '4', emoji: '🔄', label: 'Subscriptions', color: '#0ea5e9', isCustom: false },
  { id: '5', emoji: '🛒', label: 'Groceries', color: '#10b981', isCustom: false },
  { id: '6', emoji: '👥', label: 'Family', color: '#8b5cf6', isCustom: false },
  { id: '7', emoji: '💡', label: 'Utilities', color: '#eab308', isCustom: false },
  { id: '8', emoji: '👔', label: 'Fashion', color: '#06b6d4', isCustom: false },
  { id: '9', emoji: '🚑', label: 'Healthcare', color: '#ef4444', isCustom: false },
  { id: '10', emoji: '🐕', label: 'Pets', color: '#a8a29e', isCustom: false },
  { id: '11', emoji: '👟', label: 'Sneakers', color: '#6366f1', isCustom: false },
  { id: '12', emoji: '🎁', label: 'Gifts', color: '#f43f5e', isCustom: false },
];

const BUDGET_STYLES = ["Strict", "Flexible", "Passive"];
const NOTIFICATIONS = ["When I overspend", "Weekly summaries", "Daily insights", "Never"];
const INSIGHTS = ["Minimal", "Detailed", "AI - predicted trends only"];
const SAVING_GOALS = ["Travel", "Emergency fund", "Big purchase", "Paying off debt", "Custom"];
const PERSONALITIES = ["Impulsive", "Balanced", "Planner", "Let InSpend analyze later"];

export default function Onboarding(): JSX.Element {
  const router = useRouter();
  const { theme, dark: ctxDark, toggleTheme } = useTheme();

  const [step, setStep] = useState<number>(1);
  const progress = useRef(new Animated.Value(0.125)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.min(1, step / 8),
      duration: 320,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [step]);

  const [displayName, setDisplayName] = useState<string>("");
  const [income, setIncome] = useState<number>(50000);
  const sliderRef = useRef<number>(income);

  const [selectedCategories, setSelectedCategories] = useState<any[]>([]);

  const toggleCategory = useCallback((category: any) => {
    setSelectedCategories((prev) => {
      const exists = prev.find((c) => c.id === category.id);
      if (exists) {
        return prev.filter((c) => c.id !== category.id);
      } else {
        return [...prev, category];
      }
    });
  }, []);

  const [budgetStyle, setBudgetStyle] = useState<string | null>(null);
  const [monthlyLimit, setMonthlyLimit] = useState<string>("");
  const useSuggestion = useRef<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState<string>("");
  const [personality, setPersonality] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const orbA = useRef(new Animated.Value(0)).current;
  const orbB = useRef(new Animated.Value(0)).current;
  const orbC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateOrb = (orb: Animated.Value, duration: number) => (
      Animated.loop(
        Animated.sequence([
          Animated.timing(orb, { toValue: 1, duration: duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(orb, { toValue: 0, duration: duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ])
      ).start()
    );
    animateOrb(orbA, 7000);
    animateOrb(orbB, 10000);
    animateOrb(orbC, 13000);
  }, []);

  const orbStyle = (v: Animated.Value, tx: [number, number], ty: [number, number], scale: [number, number], op: [number, number]) => ({
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: tx }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: ty }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: scale }) },
    ],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: op }),
  });

  const onSliderChange = (val: number) => {
    sliderRef.current = Math.round(val);
    if (Math.random() > 0.88) setIncome(Math.round(val));
  };
  const onSliderComplete = (val: number) => {
    sliderRef.current = Math.round(val);
    setIncome(Math.round(val));
  };

  const handleMonthlyLimitChange = (raw: string) => {
    const digits = stripDigits(raw);
    if (!digits) {
      setMonthlyLimit("");
      return;
    }
    const formatted = formatNumber(digits);
    setMonthlyLimit(`₹ ${formatted}`);
    useSuggestion.current = false;
  };

  const next = async () => {
    if (step === 1) {
      if (!displayName.trim()) return Alert.alert("Name required", "Please tell us what to call you.");
      if (sliderRef.current !== income) setIncome(sliderRef.current);
    } else if (step === 2) {
      if (selectedCategories.length === 0) return Alert.alert("Pick categories", "Choose at least one category.");
    } else if (step === 3 && !budgetStyle) {
      return Alert.alert("Choose style", "Pick your preferred budgeting style.");
    } else if (step === 5 && !notification) {
      return Alert.alert("Choose notification", "Please choose a preference.");
    } else if (step === 6 && !insights) {
      return Alert.alert("Choose insights", "Please choose an insight style.");
    } else if (step === 7) {
      if (!savingGoal && !customGoal.trim()) return Alert.alert("Pick a goal", "Choose or enter a saving goal.");
    } else if (step === 8 && !personality) {
      return Alert.alert("Pick personality", "Choose a personality.");
    }

    if (step < 8) setStep((s) => s + 1);
    else await finishOnboarding();
  };

  const back = () => { if (step > 1) setStep((s) => s - 1); };

  const finishOnboarding = async () => {
    setLoading(true);
    try {
      const hasPerms = await NotificationService.requestPermissions();
      if (hasPerms && notification) {
        await NotificationService.setupPreferences(notification);
      }
      let finalDigits = stripDigits(monthlyLimit);
      if (!finalDigits || finalDigits.trim() === "") {
        if (useSuggestion.current) finalDigits = String(Math.round(income * 0.5));
        else finalDigits = "";
      }

      const finalThemePreference = ctxDark ? "dark" : "light";

      const payload: any = {
        displayName: displayName.trim(),
        income,
        categories: selectedCategories,
        budgetStyle,
        monthlyLimit: finalDigits ? Number(finalDigits) : null,
        notification: notification || "Never",
        insights: insights,
        savingGoal: savingGoal === "Custom" ? customGoal.trim() : savingGoal,
        customGoal: savingGoal === "Custom" ? customGoal.trim() : "",
        personality,
        onboardingComplete: true,
        themePreference: finalThemePreference,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(STORAGE_THEME_KEY, finalThemePreference);
      await AsyncStorage.setItem(STORAGE_NAME_KEY, displayName.trim());

      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      }

      await new Promise((r) => setTimeout(r, 500));
      router.replace("/(tabs)/home");
    } catch (err: any) {
      Alert.alert("Save error", err?.message ?? "Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    const { text, muted, inputBg, border, accent, card } = theme;

    switch (step) {
      case 1:
        return (
          <>
            <Text style={[styles.question, { color: text }]}>What should we call you?</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: text, borderColor: border }]}
              placeholder="Your name"
              placeholderTextColor={muted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <View style={{ height: 16 }} />
            <Text style={[styles.label, { color: muted }]}>What's your monthly income?</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ color: muted }}>{`₹ ${formatNumber(income)}`}</Text>
              <Text style={{ color: muted, fontSize: 12 }}>Drag to set</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={0} maximumValue={500000} step={100}
                minimumTrackTintColor={accent}
                maximumTrackTintColor={border}
                thumbTintColor={accent}
                value={income}
                onValueChange={onSliderChange}
                onSlidingComplete={onSliderComplete}
              />
            </View>
          </>
        );
      case 2:
        return (
          <>
            <Text style={[styles.question, { color: text }]}>What categories do you spend on?</Text>
            <Text style={[styles.sub, { color: muted }]}>Pick at least one.</Text>
            <View style={styles.grid}>
              {ONBOARDING_CATEGORIES.map((c) => {
                const active = selectedCategories.some((sel) => sel.id === c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? c.color + '20' : card,
                        borderColor: active ? c.color : border,
                        borderWidth: active ? 2 : 1
                      }
                    ]}
                    onPress={() => toggleCategory(c)}
                    activeOpacity={0.9}
                  >
                    <Text style={{ fontSize: 18, marginRight: 6 }}>{c.emoji}</Text>
                    <Text style={{ color: active ? c.color : text, fontWeight: "700" }}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );
      case 3:
        return (
          <>
            <Text style={[styles.question, { color: text }]}>Budgeting Style?</Text>
            <Text style={[styles.sub, { color: muted }]}>Pick one that fits your vibe.</Text>
            {BUDGET_STYLES.map((b) => {
              const active = budgetStyle === b;
              return (
                <TouchableOpacity
                  key={b}
                  style={[styles.rowCard, { backgroundColor: active ? accent + '20' : card, borderColor: active ? accent : border, borderWidth: active ? 2 : 1 }]}
                  onPress={() => setBudgetStyle(b)}
                >
                  <Text style={{ color: active ? accent : text, fontWeight: "800" }}>{b}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={accent} />}
                </TouchableOpacity>
              );
            })}
          </>
        );
      case 4:
        return (
          <>
            <Text style={[styles.question, { color: text }]}>Set a monthly spending limit</Text>
            <Text style={[styles.sub, { color: muted }]}>Type a number or let InSpend suggest one.</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: text, borderColor: border, marginTop: 12 }]}
              placeholder={`Suggested: ₹ ${formatNumber(Math.round(income * 0.5))}`}
              placeholderTextColor={muted}
              keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
              value={monthlyLimit}
              onChangeText={handleMonthlyLimitChange}
              returnKeyType="done"
            />
            <View style={{ height: 12 }} />
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: accent }]}
              onPress={() => {
                useSuggestion.current = true;
                setMonthlyLimit(`₹ ${formatNumber(Math.round(income * 0.5))}`);
              }}
            >
              <Text style={{ color: accent, fontWeight: "800" }}>Suggest one for me (50%)</Text>
            </TouchableOpacity>
          </>
        );
      case 5:
        return (
          <>
            <Text style={[styles.question, { color: text }]}>Notification Preference</Text>
            {NOTIFICATIONS.map((n) => {
              const active = notification === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.rowCard, { backgroundColor: active ? accent + '20' : card, borderColor: active ? accent : border, borderWidth: active ? 2 : 1 }]}
                  onPress={() => setNotification(n)}
                >
                  <Text style={{ color: active ? accent : text, fontWeight: "700" }}>{n}</Text>
                  {active ? <Ionicons name="radio-button-on" size={18} color={accent} /> : <Ionicons name="radio-button-off" size={18} color={muted} />}
                </TouchableOpacity>
              );
            })}
          </>
        );
      case 6:
        return (
          <>
            <Text style={[styles.question, { color: text }]}>Insight Depth</Text>
            {INSIGHTS.map((i) => {
              const active = insights === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.rowCard, { backgroundColor: active ? accent + '20' : card, borderColor: active ? accent : border, borderWidth: active ? 2 : 1 }]}
                  onPress={() => setInsights(i)}
                >
                  <Text style={{ color: active ? accent : text, fontWeight: "700" }}>{i}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={accent} />}
                </TouchableOpacity>
              );
            })}
          </>
        );
      case 7:
        return (
          <>
            <Text style={[styles.question, { color: text }]}>Saving Goal</Text>
            <View style={styles.grid}>
              {SAVING_GOALS.map((g) => {
                const active = savingGoal === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, { backgroundColor: active ? accent + '20' : card, borderColor: active ? accent : border, borderWidth: active ? 2 : 1 }]}
                    onPress={() => {
                      setSavingGoal(g);
                      if (g !== "Custom") setCustomGoal("");
                    }}
                  >
                    <Text style={{ color: active ? accent : text, fontWeight: "700" }}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {savingGoal === "Custom" && (
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: text, borderColor: border, marginTop: 12 }]}
                placeholder="Type your custom goal"
                placeholderTextColor={muted}
                value={customGoal}
                onChangeText={setCustomGoal}
              />
            )}
          </>
        );
      case 8:
        return (
          <>
            <Text style={[styles.question, { color: text }]}>Spending Personality</Text>
            {PERSONALITIES.map((p) => {
              const active = personality === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.rowCard, { backgroundColor: active ? accent + '20' : card, borderColor: active ? accent : border, borderWidth: active ? 2 : 1 }]}
                  onPress={() => setPersonality(p)}
                >
                  <Text style={{ color: active ? accent : text, fontWeight: "700" }}>{p}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={accent} />}
                </TouchableOpacity>
              );
            })}
          </>
        );
      default: return null;
    }
  };

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>

      <Animated.View style={[styles.orb, { backgroundColor: "#D76D77", opacity: 0.15, left: -160, top: -120 }, orbStyle(orbA, [-80, 40], [-40, 20], [0.92, 1.08], [0.35, 0.9])]} />
      <Animated.View style={[styles.orb, { backgroundColor: "#00F0FF", opacity: 0.15, right: -60, top: -60 }, orbStyle(orbB, [120, -80], [30, -50], [0.9, 1.18], [0.25, 0.85])]} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable
            onPress={async () => {
              try {
                await auth.signOut();
                router.replace("/");
              } catch (e) {
                console.log("Error signing out", e);
              }
            }}
            style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={{ color: theme.muted, fontSize: 16, fontWeight: "600" }}>Cancel</Text>
          </Pressable>

          <Text style={[styles.title, { color: theme.text }]}>Welcome</Text>

          <Pressable
            onPress={toggleTheme}
            style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ fontSize: 24 }}>{ctxDark ? "🌙" : "☀️"}</Text>
          </Pressable>
        </View>

        <View style={[styles.progressBar, { backgroundColor: theme.progressBg }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.accent,
                width: progressWidth,
                shadowColor: theme.accent,
                shadowOpacity: 0.8,
                shadowRadius: 5
              }
            ]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {renderStepContent()}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={back} disabled={step === 1} style={[styles.footerBtn, { opacity: step === 1 ? 0.4 : 1 }]}>
              <Ionicons name="arrow-back" size={20} color={theme.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={next}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: theme.accent,
                  shadowColor: theme.accent,
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  elevation: 5
                }
              ]}
              activeOpacity={0.9}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>{step === 8 ? "Finish" : "Next"}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  orb: { position: "absolute", width: 420, height: 420, borderRadius: 999 },
  header: { paddingTop: 18, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "900" },
  progressBar: { height: 6, marginHorizontal: 20, borderRadius: 6, overflow: "visible", marginTop: 12 },
  progressFill: { height: "100%", borderRadius: 6 },
  container: { padding: 20, paddingBottom: 60 },
  card: { borderRadius: 16, padding: 18, borderWidth: 1 },
  question: { fontSize: 20, fontWeight: "900", marginBottom: 10 },
  sub: { marginBottom: 12 },
  input: { borderRadius: 12, padding: 14, borderWidth: 1 },
  label: { fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  chip: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginRight: 10, marginBottom: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  rowCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, marginTop: 12, borderWidth: 1 },
  ghostBtn: { padding: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  footer: { marginTop: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerBtn: { padding: 12, borderRadius: 10 },
  primaryBtn: { paddingVertical: 14, paddingHorizontal: 26, borderRadius: 14 },
});