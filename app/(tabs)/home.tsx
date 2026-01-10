import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DEFAULT_INCOME_CATEGORIES } from "../../constants/Categories";
import { auth, db } from "../../firebaseConfig";
import AnimatedTransaction from "../components/AnimatedTransaction";
import CategoryProgressBar from "../components/CategoryProgressBar";
import SavingsWidget from "../components/SavingsWidget";
import Skeleton from "../components/Skeleton";
import UpcomingCard from "../components/UpcomingCard";
import { useData } from "../context/DataProvider";
import { useTheme } from "../context/ThemeContext";
import { processBankText } from "../utils/BankStatementParser";
import { applyBudgetRollover, checkBudgetRollover, dismissBudgetRollover } from "../utils/BudgetRollover";
import { NotificationService } from "../utils/NotificationService";
import { formatRecurringReminder, getUpcomingRecurringTransactions } from "../utils/RecurringReminders";
import { processManualSms, syncSmsTransactions } from "../utils/SmsService";

type Segment = {
  label: string;
  amount: number;
  color: string;
  emoji: string;
  amountFormatted?: string;
};

export default function HomeScreen(): JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();

  const { transactions, userData, loading, refreshData } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showRolloverPrompt, setShowRolloverPrompt] = useState(false);
  const [unusedBudget, setUnusedBudget] = useState(0);
  const [isApplyingRollover, setIsApplyingRollover] = useState(false);

  // Manual SMS Paste State
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const legendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived State
  const userName = userData?.displayName || "User";
  const monthlyLimit = parseFloat(userData?.monthlyLimit) || 0;
  const budgetMode = userData?.budgetStyle || userData?.budgetMode || "Flexible";

  const {
    balance,
    monthlySpent,
    breakdown,
    displayTransactions,
    upcoming
  } = useMemo(() => {
    let totalInc = 0;
    let totalExp = 0;
    let currentMonthExp = 0;
    const catMap: Record<string, Segment> = {};
    const now = new Date();
    const currentMonth = now.getMonth();

    const allFetched: any[] = [];
    const templates: any[] = [];

    transactions.forEach(t => {
      const isExpense = t.type === 'expense';
      const txDate = new Date(t.date);
      const cat = t.category || {};

      if (t.recurring && t.recurring !== 'none') {
        templates.push({ ...t, isTemplate: true });
        return;
      }

      if (isExpense) totalExp += t.amount;
      else totalInc += t.amount;

      if (isExpense && txDate.getMonth() === currentMonth && txDate.getFullYear() === now.getFullYear()) {
        currentMonthExp += t.amount;
        const label = cat.label || "Other";

        if (!catMap[label]) {
          catMap[label] = {
            label: label,
            color: cat.color || "#6b7280",
            emoji: cat.emoji || "💰",
            amount: 0
          };
        }
        catMap[label].amount += t.amount;
      }

      allFetched.push({
        ...t,
        isTemplate: false,
        title: t.note ? t.note : (cat.label || "Transaction"),
        sub: `${cat.label || 'General'} • ${t.paymentMethod || 'Cash'}`,
        amountFormatted: `${isExpense ? '-' : '+'}₹${t.amount.toLocaleString()}`,
        icon: cat.emoji || "💰",
        color: cat.color || "#6b7280",
      });
    });

    const sortedBreakdown: Segment[] = Object.values(catMap).sort((a, b) => b.amount - a.amount);
    const sortedUpcoming = templates.sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate());

    return {
      balance: totalInc - totalExp,
      monthlySpent: currentMonthExp,
      breakdown: sortedBreakdown,
      displayTransactions: allFetched,
      upcoming: sortedUpcoming
    };
  }, [transactions]);

  useEffect(() => {
    const checkRecurring = async () => {
      if (upcoming.length === 0) return;

      const currentDay = new Date().getDate();
      const itemsToAutoLog = upcoming.filter(template => {
        const templateDay = new Date(template.date).getDate();
        if (currentDay >= templateDay) {
          const collision = displayTransactions.some(t =>
            t.category?.label === template.category?.label &&
            Math.abs(t.amount) === Math.abs(template.amount) &&
            new Date(t.date).getMonth() === new Date().getMonth()
          );
          return !collision;
        }
        return false;
      });

      if (itemsToAutoLog.length > 0) {
        const batch = writeBatch(db);
        itemsToAutoLog.forEach(item => {
          const { id, isTemplate, ...cleanItem } = item;
          const newTxRef = doc(collection(db, "users", auth.currentUser!.uid, "transactions"));
          batch.set(newTxRef, {
            ...cleanItem,
            date: new Date().toISOString(),
            recurring: null,
            createdAt: new Date().toISOString()
          });
        });
        await batch.commit();
        refreshData();
      }
    };

    if (!loading && auth.currentUser) checkRecurring();
  }, [upcoming, loading, displayTransactions]);

  // ✅ CHECK BUDGET ROLLOVER ON APP LOAD
  useEffect(() => {
    const checkRollover = async () => {
      if (!userData || loading) return;
      const { shouldShow, unusedBudget: unused } = await checkBudgetRollover();
      if (shouldShow) {
        setUnusedBudget(unused);
        setShowRolloverPrompt(true);
      }
    };
    checkRollover();
  }, [userData, loading]);

  // ✅ CHECK & SCHEDULE RECURRING REMINDERS
  useEffect(() => {
    const scheduleRecurringReminders = async () => {
      if (!transactions || transactions.length === 0 || loading) return;

      // Check if user has recurring reminders enabled
      const user = auth.currentUser;
      if (!user) return;

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const recurringEnabled = snap.exists() && snap.data()?.recurringReminders === true;

        if (!recurringEnabled) return; // Skip if disabled

        // Get upcoming recurring transactions
        const upcoming = getUpcomingRecurringTransactions(transactions, 3);

        if (upcoming.length > 0) {
          const reminderText = formatRecurringReminder(upcoming);
          await NotificationService.triggerRecurringReminder(reminderText);
          console.log('✅ Recurring reminders scheduled');
        }
      } catch (e) {
        console.error('❌ Error scheduling recurring reminders:', e);
      }
    };

    scheduleRecurringReminders();
  }, [transactions, loading]);

  const handleDeleteRecurring = (item: any) => {
    Alert.alert("Delete Recurring", `Stop tracking ${item.title}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            const user = auth.currentUser;
            if (!user) return;
            await deleteDoc(doc(db, "users", user.uid, "transactions", item.id));
            refreshData();
          } catch (e) { console.log(e); }
        }
      }
    ]);
  };

  // --- SMS SCANNING --
  const handleScanSms = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert("Not Supported", "SMS scanning is only available on Android devices.");
      return;
    }

    setIsScanning(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const userCategories = [...(userData?.categories || []), ...(userData?.incomeCategories || [])];

      const result = await syncSmsTransactions(userCategories);

      if (result.success > 0) {
        Alert.alert("Success 🚀", `Added ${result.success} new transactions from SMS!`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refreshData();
      } else if (result.failed > 0) {
        // Optional: Don't annoy user if just duplicates skipped, but warn if failures
        if (result.success === 0) {
          Alert.alert("Scan Complete", "No new transactions found.");
        }
      } else {
        Alert.alert("Up to Date", "No new transactions found in your SMS.");
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message || "Failed to scan SMS.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsScanning(false);
    }
  };

  const handlePasteProcess = async () => {
    if (!pasteText.trim()) return;

    setIsUploading(true); // Reuse loading state to show spinner
    try {
      const userCategories = [...(userData?.categories || []), ...(userData?.incomeCategories || [])];
      const result = await processManualSms(pasteText, userCategories);

      setIsUploading(false);
      setShowPasteModal(false);
      setPasteText("");

      if (result.success) {
        refreshData(); // Refresh dashboard
        Alert.alert("Success", result.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Parsing Failed", result.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e) {
      setIsUploading(false);
      Alert.alert("Error", "Something went wrong.");
    }
  };

  const handlePdfUpload = async (password?: string, existingBase64?: string) => {
    try {
      let base64String = existingBase64;

      if (!base64String) {
        const result = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets) return;

        // ✅ START LOADING: File selected, starting processing
        setIsUploading(true);

        const file = result.assets[0];
        const user = auth.currentUser;
        if (!user) {
          setIsUploading(false);
          return;
        }

        base64String = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
      } else {
        // We have base64 (from password retry), so show loading again
        setIsUploading(true);
      }

      const serverUrl = "https://budget-pdf-parser.onrender.com/parse-pdf";
      const payload: any = { file_data: `data:application/pdf;base64,${base64String}` };
      if (password) payload.password = password;

      const serverResponse = await fetch(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const responseText = await serverResponse.text();
      let fnResult;
      try {
        fnResult = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server Error: ${serverResponse.status}. Check logs.`);
      }

      if (!fnResult.success) {
        if (fnResult.error === "PASSWORD_REQUIRED") {
          // 🛑 STOP LOADING: We need user input for the password
          setIsUploading(false);

          if (Platform.OS === 'ios') {
            Alert.prompt(
              "Protected PDF", "Enter password.",
              [{ text: "Cancel", style: "cancel" }, { text: "Unlock", onPress: (pass?: string) => { if (pass) handlePdfUpload(pass, base64String); } }],
              "secure-text"
            );
          } else {
            // For Android, standard alert (can't do prompt easily without custom UI, keeping fallback)
            Alert.alert("Error", "PDF is password protected.");
          }
          return;
        }
        throw new Error(fnResult.error || "Server failed");
      }

      if (fnResult.success) {
        const rawText = fnResult.text;
        const user = auth.currentUser;
        if (!user) throw new Error("User not found");

        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);
        const data = snap.data();

        const currentExpenseCats = data?.categories || [];
        const currentIncomeCats = data?.incomeCategories || [];
        const allUserCategories = [...currentExpenseCats, ...currentIncomeCats];

        const { transactions: extractedData, newCategories } = await processBankText(rawText, allUserCategories);

        if (newCategories.length > 0) {
          const newExpenses = newCategories.filter(c => !DEFAULT_INCOME_CATEGORIES.some(d => d.label === c.label));
          const newIncomes = newCategories.filter(c => DEFAULT_INCOME_CATEGORIES.some(d => d.label === c.label));

          await updateDoc(docRef, {
            categories: [...currentExpenseCats, ...newExpenses],
            incomeCategories: [...currentIncomeCats, ...newIncomes]
          });
        }

        if (extractedData.length > 0) {
          const batch = writeBatch(db);
          extractedData.forEach(tx => {
            const newRef = doc(collection(db, "users", user.uid, "transactions"));
            batch.set(newRef, { ...tx, date: tx.originalDateObj.toISOString(), createdAt: new Date().toISOString(), recurring: 'none' });
          });
          await batch.commit();

          // ✅ STOP LOADING: Success
          setIsUploading(false);
          Alert.alert("Success", `Processed ${extractedData.length} transactions!`);
          refreshData();
        } else {
          // ✅ STOP LOADING: No data found
          setIsUploading(false);
          Alert.alert("Warning", "No transactions found.");
        }
      }
    } catch (e: any) {
      // ✅ STOP LOADING: Error occurred
      setIsUploading(false);
      Alert.alert("Upload Failed", e.message);
    }
  };

  const budgetRemaining = monthlyLimit - monthlySpent;
  const leftToSpend = Math.min(budgetRemaining, balance > 0 ? balance : 0);
  const percentUsed = parseFloat(Math.min(monthlyLimit > 0 ? (monthlySpent / monthlyLimit) * 100 : 0, 100).toFixed(1));

  const formatCurrency = (amount: number) => amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  const handleSegmentPress = (segment: Segment) => {
    if (legendTimeoutRef.current) clearTimeout(legendTimeoutRef.current);
    setSelectedSegment(segment);
    legendTimeoutRef.current = setTimeout(() => setSelectedSegment(null), 3000);
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!loading) Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(); }, [loading]);

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
  };

  const orbA = useRef(new Animated.Value(0)).current;
  const orbB = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(orbA, { toValue: 1, duration: 8000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(orbA, { toValue: 0, duration: 8000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })])).start();
    Animated.loop(Animated.sequence([Animated.timing(orbB, { toValue: 1, duration: 10000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(orbB, { toValue: 0, duration: 10000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })])).start();
  }, []);
  const orbTransform = (v: Animated.Value, x: number[], y: number[]) => ({ transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: x }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: y }) }] });

  const showSmsButton = Platform.OS === 'android';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <View style={styles.orbContainer} pointerEvents="none">
        <Animated.View style={[styles.orb, { backgroundColor: theme.accent + '22', left: -100, top: 0 }, orbTransform(orbA, [-40, 40], [-20, 20])]} />
        <Animated.View style={[styles.orb, { backgroundColor: (theme.accentAlt || "#00F0FF") + '33', right: -80, top: 100 }, orbTransform(orbB, [40, -40], [20, -20])]} />
      </View>

      {/* ✅ FULL SCREEN LOADING OVERLAY */}
      <Modal transparent={true} visible={isUploading} animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.text }]}>Processing Statement...</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 5 }}>This may take a moment</Text>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refreshData().then(() => setRefreshing(false)); }} tintColor={theme.text} />}
      >
        <View style={styles.headerRow}>
          <View>
            {loading ? (
              <View><Skeleton width={150} height={28} style={{ marginBottom: 6 }} /><Skeleton width={200} height={16} /></View>
            ) : (
              <><Text style={[styles.hi, { color: theme.text }]}>{getGreeting()}, {userName}</Text><Text style={[styles.sub, { color: theme.muted }]}>Master your money with InSpend.</Text></>
            )}
          </View>
          {loading ? <Skeleton width={40} height={40} borderRadius={20} /> : <View style={{ width: 40 }} />}
        </View>

        {loading ? (
          <View style={[styles.holoCard, { backgroundColor: theme.card, height: 220, justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View><Skeleton width={100} height={16} style={{ marginBottom: 10 }} /><Skeleton width={140} height={36} /></View>
              <View style={{ alignItems: 'flex-end' }}><Skeleton width={80} height={14} style={{ marginBottom: 8 }} /><Skeleton width={100} height={20} /></View>
            </View>
            <View><Skeleton width="100%" height={14} borderRadius={7} style={{ marginBottom: 10 }} /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Skeleton width={60} height={12} /><Skeleton width={60} height={12} /></View></View>
          </View>
        ) : (
          <Animated.View style={[styles.holoCard, { backgroundColor: theme.card, shadowColor: theme.cardShadow, opacity: fadeAnim }]}>
            {budgetMode === 'Passive' ? (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="infinite" size={16} color={theme.muted} /><Text style={[styles.cardLabel, { color: theme.muted }]}>Passive Tracking</Text>
                    </View>
                    <Text style={[styles.cardAmount, { color: theme.cardText }]}>{formatCurrency(monthlySpent)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.limitText, { color: theme.muted }]}>Total Balance</Text>
                    <Text style={[styles.limitAmount, { color: theme.cardText }]}>{formatCurrency(balance)}</Text>
                  </View>
                </View>
                <View style={{ marginTop: 25, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>TOP SPENDING</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {breakdown.slice(0, 3).map((cat: any, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}>
                        <Text style={{ fontSize: 12, marginRight: 4 }}>{cat.emoji}</Text><Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{cat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={[styles.cardLabel, { color: theme.muted }]}>Safe to spend</Text>
                    <Text style={[styles.cardAmount, { color: leftToSpend <= 0 ? '#ef4444' : theme.cardText }]}>{formatCurrency(leftToSpend)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.limitText, { color: theme.muted }]}>Total Balance</Text>
                    <Text style={[styles.limitAmount, { color: theme.cardText }]}>{formatCurrency(balance)}</Text>
                  </View>
                </View>
                <View style={{ marginTop: 15 }}>
                  <CategoryProgressBar segments={breakdown} totalLimit={monthlyLimit} totalSpent={monthlySpent} theme={theme} onPress={handleSegmentPress} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, height: 20 }}>
                    {selectedSegment ? (
                      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 12, marginRight: 4 }}>{selectedSegment.emoji}</Text>
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{selectedSegment.label}</Text>
                        <Text style={{ color: theme.muted, fontSize: 12, marginLeft: 4 }}>
                          {formatCurrency(selectedSegment.amount)} <Text style={{ fontSize: 10 }}> ({((selectedSegment.amount / (monthlySpent || 1)) * 100).toFixed(0)}%)</Text>
                        </Text>
                      </Animated.View>
                    ) : (
                      <><Text style={{ color: theme.muted, fontSize: 11 }}>Limit: {formatCurrency(monthlyLimit)}</Text>{balance < budgetRemaining ? <Text style={{ color: '#eab308', fontSize: 11, fontWeight: 'bold' }}>⚠️ Low Balance</Text> : <Text style={{ color: theme.muted, fontSize: 11 }}>{percentUsed}% used</Text>}</>
                    )}
                  </View>
                </View>
              </>
            )}
          </Animated.View>
        )}

        <View style={{ marginTop: 20 }}>
          <SavingsWidget />
        </View>

        {/* --- ACTION BUTTONS --- */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 25 }}>
          {/* PDF Upload */}
          <TouchableOpacity
            onPress={() => handlePdfUpload()}
            style={[styles.uploadBtn, { flex: 1, borderColor: theme.muted }]}
          >
            <Ionicons name="document-text-outline" size={18} color={theme.accent} />
            <Text style={{ color: theme.accent, fontWeight: "bold", marginLeft: 8 }}>PDF</Text>
          </TouchableOpacity>

          {/* Android: Scan SMS */}
          {showSmsButton && (
            <TouchableOpacity
              onPress={handleScanSms}
              disabled={isScanning}
              style={[styles.uploadBtn, { flex: 1, borderColor: theme.muted, backgroundColor: isScanning ? theme.card : 'transparent' }]}
            >
              {isScanning ? (
                <ActivityIndicator color={theme.accent} size="small" />
              ) : (
                <Ionicons name="scan-outline" size={18} color={theme.accent} />
              )}
              <Text style={{ color: theme.accent, fontWeight: "bold", marginLeft: 8 }}>
                Scan
              </Text>
            </TouchableOpacity>
          )}

          {/* Manual Test Paste */}
          <TouchableOpacity
            onPress={() => setShowPasteModal(true)}
            style={[styles.uploadBtn, { flex: 1, borderColor: theme.muted }]}
          >
            <Ionicons name="clipboard-outline" size={18} color={theme.accent} />
            <Text style={{ color: theme.accent, fontWeight: "bold", marginLeft: 8 }}>
              Paste
            </Text>
          </TouchableOpacity>
        </View>

        {upcoming.length > 0 && !loading && (
          <View style={{ marginTop: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.muted, letterSpacing: 0.5 }}>UPCOMING</Text>
              {/* show net upcoming: income positive, expense negative */}
              {(() => {
                const net = upcoming.reduce((acc: number, curr: any) => acc + (curr.type === 'expense' ? -Number(curr.amount) : Number(curr.amount)), 0);
                const sign = net >= 0 ? '+' : '-';
                return <Text style={{ fontSize: 16, fontWeight: '600', color: theme.muted }}>{sign}₹{Math.abs(net).toLocaleString()}</Text>;
              })()}
            </View>
            <View style={{ height: 1, backgroundColor: theme.muted, opacity: 0.2, marginBottom: 10 }} />
            <View>{upcoming.map((item, index) => (<UpcomingCard key={`up-${index}`} item={item} theme={theme} onConfirm={() => handleDeleteRecurring(item)} />))}</View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push("/history")}><Text style={{ color: theme.accent, fontWeight: "600", fontSize: 14 }}>See All</Text></TouchableOpacity>
        </View>

        {loading ? (
          [1, 2, 3, 4].map((key) => (
            <View key={key} style={[styles.skeletonRow, { backgroundColor: theme.card }]}>
              <Skeleton width={48} height={48} borderRadius={16} />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Skeleton width={120} height={16} /><Skeleton width={60} height={16} /></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Skeleton width={80} height={12} /><Skeleton width={40} height={12} /></View>
              </View>
            </View>
          ))
        ) : (
          displayTransactions.length === 0 ? (
            <View style={styles.emptyState}><Ionicons name="receipt-outline" size={48} color={theme.muted} style={{ opacity: 0.5 }} /><Text style={{ color: theme.muted, marginTop: 10 }}>No transactions yet.</Text></View>
          ) : (
            displayTransactions.slice(0, 4).map((t, i) => (<View key={`${t.id}-${i}`}><AnimatedTransaction tx={{ ...t, amount: t.amountFormatted }} delay={i * 70} theme={theme} /></View>))
          )
        )}
      </ScrollView>

      {/* ✅ BUDGET ROLLOVER MODAL */}
      <Modal
        visible={showRolloverPrompt}
        transparent
        animationType="fade"
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={[{ backgroundColor: theme.card, borderRadius: 20, padding: 24, width: '85%' }]}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>
              🎉 Unused Budget!
            </Text>
            <Text style={{ color: theme.muted, fontSize: 15, marginBottom: 20, lineHeight: 22 }}>
              You had <Text style={{ fontWeight: 'bold', color: theme.accent }}>₹{unusedBudget.toLocaleString('en-IN')}</Text> unused from last month.
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginBottom: 20 }}>
              Would you like to carry it over to this month's budget?
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.uploadBtn, { flex: 1, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg, marginTop: 0 }]}
                onPress={async () => {
                  await dismissBudgetRollover();
                  setShowRolloverPrompt(false);
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>Not Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadBtn, { flex: 1, backgroundColor: theme.accent, borderWidth: 0, marginTop: 0 }]}
                disabled={isApplyingRollover}
                onPress={async () => {
                  setIsApplyingRollover(true);
                  const success = await applyBudgetRollover(unusedBudget);
                  setIsApplyingRollover(false);
                  setShowRolloverPrompt(false);
                  if (success) {
                    refreshData();
                    Alert.alert('✅ Done!', `Added ₹${unusedBudget.toLocaleString('en-IN')} to your budget!`);
                  }
                }}
              >
                {isApplyingRollover ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Add It! 💰</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ PASTE SMS TEST MODAL */}
      <Modal visible={showPasteModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
        >
          <View style={{ backgroundColor: theme.card, width: '90%', padding: 20, borderRadius: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Test SMS Parsing</Text>
              <TouchableOpacity onPress={() => setShowPasteModal(false)}>
                <Ionicons name="close-circle" size={24} color={theme.muted} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.muted, marginBottom: 15 }}>
              Paste a bank SMS here to test the parser. New categories will be created automatically.
            </Text>

            <TextInput
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                padding: 15,
                borderRadius: 12,
                height: 120,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: theme.border
              }}
              multiline
              placeholder="Paste SMS here..."
              placeholderTextColor={theme.muted}
              value={pasteText}
              onChangeText={setPasteText}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setShowPasteModal(false)}
                style={{ flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePasteProcess}
                style={{ flex: 1, padding: 15, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Process SMS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  orbContainer: { position: "absolute", top: 80, left: 0, right: 0, height: 340 },
  orb: { position: "absolute", width: 420, height: 420, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 40, elevation: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, zIndex: 2 },
  hi: { fontSize: 24, fontWeight: "900" },
  sub: { marginTop: 2, fontSize: 14 },
  holoCard: { marginTop: 8, borderRadius: 20, padding: 25, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, zIndex: 2 },
  cardLabel: { fontSize: 14, fontWeight: '600' },
  cardAmount: { fontSize: 38, fontWeight: "900", marginTop: 5 },
  limitText: { fontSize: 12, fontWeight: '500' },
  limitAmount: { fontWeight: "700", marginTop: 4, fontSize: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  uploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 0, padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", zIndex: 2 },
  emptyState: { alignItems: "center", marginTop: 40, opacity: 0.7, zIndex: 2 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12, borderRadius: 20 },

  // ✅ STYLES FOR LOADING OVERLAY
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  },
  loadingBox: {
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '700'
  }
});