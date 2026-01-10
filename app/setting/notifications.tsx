import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { useTheme } from "../context/ThemeContext";
import { NotificationService } from "../utils/NotificationService";

const OPTIONS = [
  "When I overspend",
  "Weekly summaries",
  "Daily insights",
  "Never",
];

export default function NotificationSettings() {
  const { theme } = useTheme();
  const router = useRouter();

  const [selected, setSelected] = useState<string | null>(null);
  const [recurringReminders, setRecurringReminders] = useState(false);
  const [notificationThreshold, setNotificationThreshold] = useState("1000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }
        const snap = await getDoc(doc(db, "users", user.uid));
        if (mounted && snap.exists()) {
          const data = snap.data();
          // ✅ Check 'notification' field (from onboarding)
          setSelected(data.notification || null);
          // ✅ Load recurring reminders preference
          setRecurringReminders(data.recurringReminders || false);
          // ✅ Load notification threshold
          setNotificationThreshold(String(data.notificationThreshold || 1000));
          
          // ✅ Store initial data for dirty checking
          if (!saving) {
            setInitialData({
              selected: data.notification || null,
              recurringReminders: data.recurringReminders || false,
              notificationThreshold: String(data.notificationThreshold || 1000)
            });
          }
        }
      } catch (e) {
        console.log("load notification error", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // ✅ CHECK FOR CHANGES (Button Animation)
  useEffect(() => {
    if (!initialData) return;

    const current = {
      selected,
      recurringReminders,
      notificationThreshold
    };

    const isDifferent = JSON.stringify(current) !== JSON.stringify(initialData);

    Animated.timing(slideAnim, {
      toValue: isDifferent ? 0 : 300,
      duration: 350,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true
    }).start();

  }, [selected, recurringReminders, notificationThreshold, initialData]);

  const save = async () => {
    if (!selected) {
      Alert.alert("Pick one", "Please choose when InSpend should notify you.");
      return;
    }

    // Validate threshold is a positive number
    const thresholdNum = parseInt(notificationThreshold, 10);
    if (isNaN(thresholdNum) || thresholdNum <= 0) {
      Alert.alert("Invalid threshold", "Please enter a valid positive number for the notification threshold.");
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      
      // ✅ Save to Firebase with correct field name and threshold
      await setDoc(doc(db, "users", user.uid), { 
        notification: selected,
        recurringReminders: recurringReminders,
        notificationThreshold: thresholdNum
      }, { merge: true });
      
      // ✅ Setup notification preferences with NotificationService
      if (selected !== "Never") {
        await NotificationService.requestPermissions();
        await NotificationService.setupPreferences(selected);
      } else {
        // Cancel all if user selects "Never"
        await NotificationService.setupPreferences("Never");
      }

      // ✅ Setup recurring reminders if enabled
      if (recurringReminders) {
        await NotificationService.requestPermissions();
        await NotificationService.setupPreferences("Recurring reminders");
      }
      
      // ✅ Update initial data to hide button
      setInitialData({
        selected,
        recurringReminders,
        notificationThreshold
      });

      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true
      }).start();

      setSaving(false);
      router.back();
    } catch (e: any) {
      setSaving(false);
      Alert.alert("Save failed", e?.message ?? "Unknown error");
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
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ padding: 20 }}>
          <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>When should InSpend notify you?</Text>

          <View style={{ height: 18 }} />

        {OPTIONS.map((opt) => {
          const active = selected === opt;
          return (
            <TouchableOpacity
              key={opt}
              activeOpacity={0.9}
              onPress={() => setSelected(opt)}
              style={[
                styles.option, 
                { 
                  backgroundColor: active ? theme.accent : theme.card,
                  borderColor: theme.card 
                }
              ]}
            >
              <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "700" }}>{opt}</Text>
              
              {active ? (
                <Ionicons name="radio" size={22} color="#fff" />
              ) : (
                <Ionicons name="ellipse-outline" size={22} color={theme.muted} />
              )}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 20 }} />
        <Text style={[styles.subtitle, { color: theme.muted, marginBottom: 12 }]}>Additional Options</Text>

        {/* Recurring Reminders Toggle */}
        <TouchableOpacity
          onPress={() => setRecurringReminders(!recurringReminders)}
          style={[
            styles.option,
            {
              backgroundColor: recurringReminders ? theme.accent : theme.card,
              borderColor: theme.card
            }
          ]}
        >
          <Text style={{ color: recurringReminders ? "#fff" : theme.text, fontWeight: "700" }}>
            📅 Recurring Expense Reminders
          </Text>
          {recurringReminders ? (
            <Ionicons name="toggle" size={24} color="#fff" />
          ) : (
            <Ionicons name="toggle-outline" size={24} color={theme.muted} />
          )}
        </TouchableOpacity>
        <Text style={[styles.subtitle, { color: theme.muted, marginTop: 8, marginBottom: 12 }]}>
          Get notified about upcoming recurring transactions (daily at 8 AM)
        </Text>

        <View style={{ height: 16 }} />
        <Text style={[styles.subtitle, { color: theme.muted, marginBottom: 12 }]}>Notification Threshold 🎯</Text>
        
        {selected === "When I overspend" ? (
          <View style={[styles.option, { backgroundColor: theme.card, borderColor: theme.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 8 }}>Alert me when safe to spend falls below:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontSize: 16, marginRight: 8 }}>₹</Text>
                <TextInput
                  value={notificationThreshold}
                  onChangeText={setNotificationThreshold}
                  keyboardType="number-pad"
                  placeholder="1000"
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: theme.text,
                    fontSize: 14
                  }}
                  placeholderTextColor={theme.muted}
                />
              </View>
              <Text style={{ color: theme.muted, fontSize: 11, marginTop: 6 }}>
                You'll get a notification whenever your safe to spend balance drops below this amount.
              </Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: theme.muted, fontSize: 12, fontStyle: 'italic', padding: 12, backgroundColor: theme.card, borderRadius: 8 }}>
            ℹ️ The threshold setting only applies when "When I overspend" is selected.
          </Text>
        )}
        </View>
      </ScrollView>

      {/* ✅ FLOATING ACTION BUTTON */}
      <Animated.View style={[styles.floatingContainer, { transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity 
          style={[styles.floatingBtn, { backgroundColor: theme.accent }]} 
          onPress={save}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: { fontSize: 26, fontWeight: "900" },
  subtitle: { marginTop: 6, fontSize: 14 },
  option: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },
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