import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";
import AnimatedTransaction from "./components/AnimatedTransaction";
import { useTheme } from "./context/ThemeContext";

const { width } = Dimensions.get("window");

export default function HistoryScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<any[]>([]); // Store raw data here
  const [sections, setSections] = useState<any[]>([]); // Display data here
  const [searchQuery, setSearchQuery] = useState("");

  // --- SAFE NAVIGATION HELPER ---
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/home");
    }
  };

  const handleDeleteTransaction = (item: any) => {
    Alert.alert("Delete Transaction", "Are you sure you want to delete this log?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            const user = auth.currentUser;
            if (!user) return;
            await deleteDoc(doc(db, "users", user.uid, "transactions", item.id));
            fetchHistory(); // Refresh the list
          } catch (e) { console.error(e); }
        }
      }
    ]);
  };

  // --- DATA PROCESSOR (Groups List by Month) ---
  const groupDataByMonth = (dataList: any[]) => {
    const groupedData: { [key: string]: { title: string, net: number, data: any[] } } = {};

    dataList.forEach((t) => {
      const dateObj = new Date(t.date);
      const monthKey = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (!groupedData[monthKey]) {
        groupedData[monthKey] = { title: monthKey, net: 0, data: [] };
      }

      groupedData[monthKey].data.push(t);

      // Calculate Net Flow for that month based on filtered data
      if (t.type === 'income') {
        groupedData[monthKey].net += t.rawAmount;
      } else {
        groupedData[monthKey].net -= t.rawAmount;
      }
    });

    setSections(Object.values(groupedData));
  };

  // --- SEARCH LOGIC ---
  const handleSearch = (text: string) => {
    setSearchQuery(text);

    if (!text.trim()) {
      groupDataByMonth(allTransactions); // Reset to full list
      return;
    }

    const lower = text.toLowerCase();

    const filtered = allTransactions.filter(tx => {
      // 1. Match Name or Note
      const titleMatch = tx.title.toLowerCase().includes(lower);

      // 2. Match Category (e.g. "Food")
      const catMatch = tx.sub.toLowerCase().includes(lower);

      // 3. Match Amount (e.g. "500")
      const amountMatch = tx.rawAmount.toString().includes(lower);

      // 4. Smart Type Matching (Credit/Debit/Income/Expense)
      let typeMatch = false;
      if (lower === 'income' || lower === 'credit') typeMatch = tx.type === 'income';
      if (lower === 'expense' || lower === 'debit') typeMatch = tx.type === 'expense';

      return titleMatch || catMatch || amountMatch || typeMatch;
    });

    groupDataByMonth(filtered);
  };

  // --- FETCH DATA ---
  const fetchHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "users", user.uid, "transactions"),
        orderBy("date", "desc"),
        limit(500) // Limit to 500 for performance
      );

      const querySnapshot = await getDocs(q);
      const parsedData: any[] = [];

      querySnapshot.forEach((doc) => {
        const raw = doc.data();
        const cat = raw.category || {};

        parsedData.push({
          id: doc.id,
          title: raw.note ? raw.note : (cat.label || "Transaction"),
          sub: `${cat.label || 'General'} • ${raw.paymentMethod || 'Cash'}`,
          amount: `${raw.type === 'expense' ? '-' : '+'}₹${raw.amount.toLocaleString()}`,

          // Icons & Colors
          icon: cat.emoji || "💰",
          color: cat.color || "#6b7280",

          date: raw.date,
          type: raw.type,
          rawAmount: raw.amount
        });
      });

      setAllTransactions(parsedData);
      groupDataByMonth(parsedData);

    } catch (e) {
      console.error("Error loading history:", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [])
  );

  const renderSectionHeader = ({ section: { title, net } }: any) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
      <Text style={[styles.monthText, { color: theme.text }]}>{title}</Text>
      <View style={[
        styles.netBadge,
        { backgroundColor: net >= 0 ? '#22c55e20' : '#ef444420' }
      ]}>
        <Text style={{
          color: net >= 0 ? '#22c55e' : '#ef4444',
          fontWeight: 'bold',
          fontSize: 12
        }}>
          {net >= 0 ? '+' : ''}₹{net.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={[styles.iconBtn, { backgroundColor: theme.card }]}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* SEARCH BAR */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.muted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search food, salary, debit..."
            placeholderTextColor={theme.muted}
            style={{ flex: 1, color: theme.text, fontSize: 16 }}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() => handleDeleteTransaction(item)}
              style={{ paddingHorizontal: 20 }}
            >
              <AnimatedTransaction tx={item} delay={index * 30} theme={theme} />
            </TouchableOpacity>
          )}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Ionicons name="search-outline" size={64} color={theme.muted} style={{ opacity: 0.5 }} />
              <Text style={{ color: theme.muted, marginTop: 10 }}>No transactions found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 10 },
  monthText: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 },
  netBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
});