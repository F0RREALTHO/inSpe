import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AnimatedProgress from "./components/AnimatedProgress";
import AnimatedTransaction from "./components/AnimatedTransaction";
import PulsingCat from "./components/PulsingCat";

import { useData } from "./context/DataProvider";
import { useTheme } from "./context/ThemeContext";

import { syncSmsTransactions } from "./utils/SmsService";

const { width } = Dimensions.get("window");

export default function DashboardScreen() {
  const { theme, dark, toggleTheme } = useTheme();
  const router = useRouter();
  const { transactions, userData, loading: dataLoading } = useData();
  const [scanning, setScanning] = useState(false);

  const headerY = useRef(new Animated.Value(-120)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardWiggle = useRef(new Animated.Value(0)).current;

  const spark1 = useRef(new Animated.ValueXY({ x: -40, y: -20 })).current;
  const spark2 = useRef(new Animated.ValueXY({ x: 60, y: -10 })).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerY, { toValue: 0, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.loop(Animated.sequence([
        Animated.timing(cardWiggle, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(cardWiggle, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(spark1, { toValue: { x: -10, y: -60 }, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      Animated.timing(spark1, { toValue: { x: -40, y: -20 }, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(spark2, { toValue: { x: 30, y: -50 }, duration: 4500, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      Animated.timing(spark2, { toValue: { x: 60, y: -10 }, duration: 4500, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
    ])).start();
  }, []);


  const { totalBalance, monthlyLimit, percentUsed } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const income = transactions
      .filter(t => t.type === 'income' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const expense = transactions
      .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const balance = income - expense;

    const limit = typeof userData?.monthlyLimit === 'number'
      ? userData.monthlyLimit
      : parseFloat(userData?.monthlyLimit || "0");

    const pct = limit > 0 ? Math.min(100, (expense / limit) * 100) : 0;

    return { totalBalance: balance, monthlyLimit: limit, percentUsed: pct };
  }, [transactions, userData]);

  const topCategories = useMemo(() => {
    const expenseTxs = transactions.filter(t => t.type === 'expense');
    const catMap: Record<string, { id: string, label: string, amount: number, emoji: string, color: string }> = {};

    expenseTxs.forEach(t => {
      if (!t.category) return;
      const cid = t.category.id;
      if (!catMap[cid]) {
        catMap[cid] = {
          id: cid,
          label: t.category.label,
          amount: 0,
          emoji: t.category.emoji,
          color: t.category.color
        };
      }
      catMap[cid].amount += Number(t.amount);
    });

    const totalExpense = Object.values(catMap).reduce((sum, c) => sum + c.amount, 0);

    return Object.values(catMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(c => ({
        ...c,
        spent: `₹${c.amount.toLocaleString('en-IN')}`,
        pct: totalExpense > 0 ? Math.round((c.amount / totalExpense) * 100) : 0
      }));
  }, [transactions]);

  const handleScanSms = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert("Not Supported", "SMS scanning is only available on Android devices.");
      return;
    }

    setScanning(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const userCategories = [...(userData?.categories || []), ...(userData?.incomeCategories || [])];

      const result = await syncSmsTransactions(userCategories);

      if (result.success > 0) {
        Alert.alert("Success 🚀", `Added ${result.success} new transactions from SMS!`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result.failed > 0) {
        Alert.alert("Complete", `No new valid transactions found. (${result.failed} failed/skipped)`);
      } else {
        Alert.alert("Up to Date", "No new transactions found in your SMS.");
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message || "Failed to scan SMS.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setScanning(false);
    }
  };


  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

        <Animated.View style={{ transform: [{ translateY: headerY }] }}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.hi, { color: theme.text }]}>Hello, {userData?.name || "User"} 👋</Text>
              <Text style={[styles.sub, { color: theme.muted }]}>Your financial dashboard</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={toggleTheme}
                style={[styles.toggleBtn, { backgroundColor: theme.card }]}
              >
                <Ionicons name={dark ? "moon" : "sunny"} size={20} color={theme.text} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.profileBtn, { marginLeft: 12, backgroundColor: theme.accent }]} onPress={() => router.push("/(tabs)/profile")}>
                <Text style={styles.profileInitial}>{(userData?.name?.[0] || "U").toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>


        <Animated.View
          style={[
            styles.holoCard,
            {
              backgroundColor: theme.card,
              shadowColor: theme.accent, // Neon Shadow
              opacity: fadeAnim,
              transform: [{ translateY: cardWiggle.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }]
            }
          ]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={[styles.cardLabel, { color: theme.muted }]}>Total Balance</Text>
              <Text style={[styles.cardAmount, { color: theme.text }]}>
                ₹{totalBalance.toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.limitText, { color: theme.muted }]}>Monthly limit</Text>
              <Text style={[styles.limitAmount, { color: theme.text }]}>
                ₹{monthlyLimit.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <AnimatedProgress percent={percentUsed} theme={theme} />
          </View>

          <Animated.View style={[styles.spark, { backgroundColor: theme.accent, transform: [{ translateX: spark1.x }, { translateY: spark1.y }], opacity: 0.3 }]} />
          <Animated.View style={[styles.spark, { backgroundColor: theme.accentAlt, transform: [{ translateX: spark2.x }, { translateY: spark2.y }], opacity: 0.2 }]} />
        </Animated.View>

        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Categories</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/insights")}>
              <Text style={{ color: theme.accent, fontWeight: "700" }}>See all</Text>
            </TouchableOpacity>
          </View>

          {topCategories.length > 0 ? (
            <FlatList
              horizontal
              data={topCategories}
              keyExtractor={(i) => i.id}
              renderItem={({ item, index }) => <PulsingCat item={item} index={index} theme={theme} />}
              contentContainerStyle={{ paddingVertical: 12 }}
              showsHorizontalScrollIndicator={false}
            />
          ) : (
            <Text style={{ color: theme.muted, marginTop: 10, fontStyle: 'italic' }}>No expenses yet this month.</Text>
          )}
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Transactions</Text>
          {transactions.slice(0, 5).map((t, i) => (
            <AnimatedTransaction
              key={t.id}
              tx={{ ...t, title: t.note || t.category?.label || "Transaction", sub: `${new Date(t.date).toLocaleDateString()} • ${t.paymentMethod}` }}
              delay={i * 100}
              theme={theme}
            />
          ))}
          {transactions.length === 0 && (
            <Text style={{ color: theme.muted, marginTop: 10, fontStyle: 'italic' }}>No transactions found.</Text>
          )}
        </View>

        <View style={{ marginTop: 24, flexDirection: "row", justifyContent: "space-between" }}>
          <TouchableOpacity
            style={[styles.actionPrimary, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
            onPress={() => router.push("/add")}
          >
            <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ color: "#fff", fontWeight: "800" }}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionGhost, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={handleScanSms}
            disabled={scanning || Platform.OS !== 'android'}
          >
            {scanning ? (
              <ActivityIndicator color={theme.text} size="small" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="scan" size={20} color={theme.text} style={{ marginRight: 8 }} />
            )}
            <Text style={{ color: theme.text, fontWeight: "800" }}>
              {scanning ? "Scanning..." : "Scan SMS"}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  hi: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: 2, fontSize: 13 },
  profileBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  profileInitial: { color: "#fff", fontWeight: "900", fontSize: 18 },
  toggleBtn: { padding: 10, borderRadius: 12 },

  holoCard: {
    marginTop: 12,
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    shadowOffset: { width: 0, height: 8 }
  },
  cardLabel: { fontSize: 13, fontWeight: '600' },
  cardAmount: { fontSize: 36, fontWeight: "900", marginTop: 6, letterSpacing: 0.5 },
  limitText: { fontSize: 12 },
  limitAmount: { fontWeight: "800", marginTop: 4, fontSize: 16 },

  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 10 },

  actionPrimary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: 'center',
    marginRight: 12,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5
  },
  actionGhost: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: 'center',
    borderWidth: 1
  },

  spark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: "absolute",
    right: 18,
    top: 8,
    shadowOpacity: 0.8,
    shadowRadius: 5
  },
});