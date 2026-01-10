import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { useTheme } from "../context/ThemeContext";
import { formatCurrency } from "../utils/formatCurrency";

const STORAGE_NAME_KEY = "@inspend_name";

/* --- CONSTANTS --- */
const BUDGET_STYLES = [
  { id: 'Strict', emoji: '🔒', label: 'Strict', desc: 'Hard limits. No overspending.' },
  { id: 'Flexible', emoji: '🌿', label: 'Flexible', desc: 'Adjustable limits. Go with the flow.' },
  { id: 'Passive', emoji: '🧘', label: 'Passive', desc: 'Just tracking. No limits.' },
];

const INSIGHTS = [
  { id: 'Minimal', emoji: '📊', label: 'Minimal', desc: 'Just the totals.' },
  { id: 'Detailed', emoji: '📈', label: 'Detailed', desc: 'Charts & breakdowns.' },
  { id: 'AI', emoji: '🤖', label: 'AI Powered', desc: 'Smart tips & analysis.' },
];

const SAVING_GOALS = [
  { id: 'Travel', emoji: '✈️', label: 'Travel', desc: 'Saving for a trip.' },
  { id: 'Emergency', emoji: '🆘', label: 'Emergency Fund', desc: 'Safety net for rainy days.' },
  { id: 'Big purchase', emoji: '🏡', label: 'Big Purchase', desc: 'House, Car, or Gadgets.' },
  { id: 'Paying off debt', emoji: '💳', label: 'Paying Debt', desc: 'Clearing loans or credit cards.' },
  { id: 'Custom', emoji: '✨', label: 'Custom', desc: 'Your own personal goal.' },
];

const PERSONALITIES = [
  { id: 'Impulsive', emoji: '🔥', label: 'Impulsive', desc: 'I buy what I like instantly.' },
  { id: 'Balanced', emoji: '⚖️', label: 'Balanced', desc: 'I spend, but I save too.' },
  { id: 'Planner', emoji: '📝', label: 'Planner', desc: 'Every penny is accounted for.' },
  { id: 'Analyze', emoji: '🔍', label: 'Let InSpend analyze', desc: 'Figure me out later.' },
];

export default function ProfileManagement(): JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  // --- FORM STATE ---
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [incomeNumber, setIncomeNumber] = useState<number | null>(null);
  const [incomeDisplay, setIncomeDisplay] = useState<string>("");
  const [monthlyLimitNumber, setMonthlyLimitNumber] = useState<number | null>(null);
  const [monthlyLimitDisplay, setMonthlyLimitDisplay] = useState<string>("");

  const [categories, setCategories] = useState<string[]>([]);
  const [budgetStyle, setBudgetStyle] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState<string>("");
  const [personality, setPersonality] = useState<string | null>(null);

  // --- DIRTY CHECKING ---
  const [initialData, setInitialData] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(300)).current; 

  // Dynamic Theme Colors
  const inputBg = theme.inputBg || theme.card; 
  const border = theme.border || "rgba(255,255,255,0.1)";

  // 1. REAL-TIME LISTENER
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/");
      return;
    }
    setEmail(user.email ?? "");

    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();

            if (!saving) {
                setDisplayName(data.displayName ?? "");
                
                const incNum = typeof data.income === "number" ? data.income : null;
                setIncomeNumber(incNum);
                setIncomeDisplay(incNum ? formatCurrency(incNum) : "");

                const limNum = typeof data.monthlyLimit === "number" ? data.monthlyLimit : null;
                setMonthlyLimitNumber(limNum);
                setMonthlyLimitDisplay(limNum ? formatCurrency(limNum) : "");

                setBudgetStyle(data.budgetStyle ?? null);
                setNotification(data.notifications ?? null); // Fixed key to 'notifications'

                setInsights(data.insights ?? null);
                
                // Custom Goal Logic
                const savedGoalValue = data.savingGoal;
                const isStandardGoal = SAVING_GOALS.some(g => g.id === savedGoalValue);

                if (isStandardGoal) {
                    setSavingGoal(savedGoalValue);
                    setCustomGoal("");
                } else if (savedGoalValue) {
                    setSavingGoal("Custom");
                    setCustomGoal(savedGoalValue);
                } else {
                    setSavingGoal(null);
                    setCustomGoal("");
                }

                setPersonality(data.personality ?? null);
                setCategories(data.categories || []);

                // Update Baseline for Dirty Check
                setInitialData({
                    displayName: data.displayName ?? "",
                    income: incNum,
                    monthlyLimit: limNum,
                    budgetStyle: data.budgetStyle ?? null,
                    notification: data.notifications ?? null, 
                    insights: data.insights ?? null,
                    savingGoal: isStandardGoal ? savedGoalValue : (savedGoalValue ? "Custom" : null),
                    customGoal: isStandardGoal ? "" : (savedGoalValue || ""),
                    personality: data.personality ?? null
                });
            }
            setLoading(false);
        }
    }, (error) => {
        console.error("Listener Error:", error);
        setLoading(false);
    });

    return () => unsub(); 
  }, []);

  // 2. CHECK FOR CHANGES (Button Animation)
  useEffect(() => {
    if (!initialData) return;

    const current = {
        displayName,
        income: incomeNumber,
        monthlyLimit: monthlyLimitNumber,
        budgetStyle,
        notification, 
        insights,
        savingGoal,
        customGoal,
        personality
    };

    const isDifferent = JSON.stringify(current) !== JSON.stringify(initialData);

    Animated.timing(slideAnim, {
        toValue: isDifferent ? 0 : 300, 
        duration: 350,
        easing: Easing.out(Easing.back(1.5)), 
        useNativeDriver: true
    }).start();

  }, [displayName, incomeNumber, monthlyLimitNumber, budgetStyle, notification, insights, savingGoal, customGoal, personality, initialData]);


  const onIncomeChange = (text: string) => {
    const digits = text.replace(/\D/g, "");
    const parsed = digits ? parseInt(digits, 10) : null;
    setIncomeNumber(parsed);
    setIncomeDisplay(formatCurrency(digits));
  };

  const onLimitChange = (text: string) => {
    const digits = text.replace(/\D/g, "");
    const parsed = digits ? parseInt(digits, 10) : null;
    setMonthlyLimitNumber(parsed);
    setMonthlyLimitDisplay(formatCurrency(digits));
  };

  const validateAndSave = async () => {
    if (!displayName.trim()) return Alert.alert("Name required", "Display name cannot be empty.");
    
    setSaving(true); 
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const finalSavingGoal = savingGoal === "Custom" ? customGoal.trim() : savingGoal;

      const payload = {
        displayName: displayName.trim(),
        income: incomeNumber ?? null,
        monthlyLimit: monthlyLimitNumber ?? null,
        categories: categories ?? [],
        budgetStyle: budgetStyle ?? null,
        notifications: notification ?? null, // Fixed key
        insights: insights ?? null,
        savingGoal: finalSavingGoal ?? null,
        customGoal: (savingGoal === "Custom" ? customGoal.trim() : "") ?? "", 
        personality: personality ?? null,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      await AsyncStorage.setItem(STORAGE_NAME_KEY, displayName.trim());

      setInitialData({
        displayName: displayName.trim(),
        income: incomeNumber ?? null,
        monthlyLimit: monthlyLimitNumber ?? null,
        budgetStyle: budgetStyle ?? null,
        notification: notification ?? null, 
        insights: insights ?? null,
        savingGoal, 
        customGoal: customGoal.trim(),
        personality: personality ?? null
      }); 
      
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true
      }).start();

    } catch (err: any) {
      console.error(err);
      Alert.alert("Save failed", err.message);
    } finally {
      setSaving(false); 
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <Text style={[styles.title, { color: theme.text }]}>Profile management</Text>
          <Text style={[styles.sub, { color: theme.muted }]}>Edit your account & budgeting preferences</Text>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: border }]}>
            
            {/* NAME & EMAIL */}
            <Text style={[styles.label, { color: theme.muted }]}>Display name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: theme.text, borderColor: border }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={theme.muted}
            />

            <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>Email (read-only)</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: inputBg, color: theme.text, borderColor: border }]} 
              value={email} 
              editable={false} 
            />

            <TouchableOpacity 
                onPress={() => sendPasswordResetEmail(auth, email)}
                style={{ alignSelf: 'flex-end', marginTop: 8, padding: 4 }}
            >
                <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>Change Password</Text>
            </TouchableOpacity>

            {/* INCOME & LIMIT */}
            <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>Monthly income</Text>
            <View style={styles.prefixRow}>
              <Text style={[styles.prefix, { color: theme.text }]}>₹</Text>
              <TextInput
                style={[styles.inputFlex, { backgroundColor: inputBg, color: theme.text, borderColor: border }]}
                placeholder="e.g. 50,000"
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                value={incomeDisplay}
                onChangeText={onIncomeChange}
                placeholderTextColor={theme.muted}
                maxLength={12}
              />
            </View>

            <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>Monthly spending limit</Text>
            <View style={styles.prefixRow}>
              <Text style={[styles.prefix, { color: theme.text }]}>₹</Text>
              <TextInput
                style={[styles.inputFlex, { backgroundColor: inputBg, color: theme.text, borderColor: border }]}
                placeholder="e.g. 25,000"
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                value={monthlyLimitDisplay}
                onChangeText={onLimitChange}
                placeholderTextColor={theme.muted}
                maxLength={12}
              />
            </View>

            {/* BUDGET STYLE */}
            <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>Budget style</Text>
            {BUDGET_STYLES.map((b) => {
              const active = budgetStyle === b.id;
              return (
                <TouchableOpacity 
                  key={b.id} 
                  style={[styles.rowCard, { backgroundColor: theme.card, borderColor: active ? theme.accent : border, borderWidth: active ? 2 : 1 }]} 
                  onPress={() => setBudgetStyle(b.id)}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{b.emoji}</Text>
                  <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>{b.label}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>{b.desc}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={24} color={theme.accent} />}
                </TouchableOpacity>
              );
            })}

            {/* NOTIFICATIONS */}
            <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>Notifications</Text>
            <TouchableOpacity
              style={[styles.rowCard, { backgroundColor: theme.card, borderColor: border, borderWidth: 1 }]}
              onPress={() => router.push("./notifications")}
            >
              <View>
                <Text style={{ color: theme.text, fontWeight: "700" }}>{notification ?? "Set Preference"}</Text>
                <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>Tap to change preference</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.muted} />
            </TouchableOpacity>

            {/* INSIGHTS */}
            <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>Insights</Text>
            {INSIGHTS.map((i) => {
              const active = insights === i.id;
              return (
                <TouchableOpacity 
                  key={i.id} 
                  style={[styles.rowCard, { backgroundColor: theme.card, borderColor: active ? theme.accent : border, borderWidth: active ? 2 : 1 }]} 
                  onPress={() => setInsights(i.id)}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{i.emoji}</Text>
                  <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>{i.label}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>{i.desc}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={24} color={theme.accent} />}
                </TouchableOpacity>
              );
            })}

            {/* SAVING GOAL */}
            <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>Saving goal</Text>
            <View style={{ gap: 8 }}>
              {SAVING_GOALS.map((g) => {
                const active = savingGoal === g.id;
                return (
                  <TouchableOpacity 
                    key={g.id} 
                    style={[styles.rowCard, { backgroundColor: theme.card, borderColor: active ? theme.accent : border, borderWidth: active ? 2 : 1 }]} 
                    onPress={() => { setSavingGoal(g.id); if (g.id !== "Custom") setCustomGoal(""); }}
                  >
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{g.emoji}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>{g.label}</Text>
                        <Text style={{ color: theme.muted, fontSize: 12 }}>{g.desc}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={24} color={theme.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {savingGoal === "Custom" && (
              <TextInput 
                style={[styles.input, { backgroundColor: inputBg, color: theme.text, borderColor: border, marginTop: 10 }]} 
                placeholder="Type your custom goal" 
                placeholderTextColor={theme.muted} 
                value={customGoal} 
                onChangeText={setCustomGoal} 
              />
            )}

            {/* PERSONALITY */}
            <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>Spending personality</Text>
            {PERSONALITIES.map((p) => {
              const active = personality === p.id;
              return (
                <TouchableOpacity 
                  key={p.id} 
                  style={[styles.rowCard, { backgroundColor: theme.card, borderColor: active ? theme.accent : border, borderWidth: active ? 2 : 1 }]} 
                  onPress={() => setPersonality(p.id)}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{p.emoji}</Text>
                  <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>{p.label}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>{p.desc}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={24} color={theme.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* ✨ FLOATING SAVE BUTTON ✨ */}
        <Animated.View style={[styles.floatingContainer, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity 
                style={[styles.floatingBtn, { backgroundColor: theme.accent }]} 
                onPress={validateAndSave}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginRight: 8}} />
                        <Text style={styles.floatingText}>Save Changes</Text>
                    </>
                )}
            </TouchableOpacity>
        </Animated.View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: 6, fontSize: 13 },
  card: { marginTop: 18, borderRadius: 14, padding: 16, borderWidth: 1, overflow: "hidden" },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { borderRadius: 12, padding: 12, borderWidth: 1 },
  prefixRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefix: { fontSize: 18, fontWeight: "900", paddingHorizontal: 8 },
  inputFlex: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1 },
  rowCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 12, marginTop: 8 },
  
  // Floating Button Styles
  floatingContainer: {
    position: 'absolute',
    bottom: 40, 
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    width: '100%', 
  },
  floatingText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  }
});