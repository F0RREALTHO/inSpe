import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, setDoc, writeBatch, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { useData } from "../context/DataProvider";
import { useTheme } from "../context/ThemeContext";

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { CsvService } from "../utils/CsvService";
import { AICategorizationService } from "../utils/AICategorizationService";
import { checkSmsPermissions, requestSmsPermissions, syncSmsTransactions } from "../utils/SmsService";

import ConfettiCannon from 'react-native-confetti-cannon';

const SettingRow = ({ icon, color, label, value, isSwitch, switchValue, onToggle, onPress, isLast, isDestructive }: any) => {
  const { theme } = useTheme();

  const handlePress = () => {
    if (isSwitch && onToggle) {
      Haptics.selectionAsync();
      onToggle(!switchValue);
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: theme.card,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: theme.bg
        }
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text
          style={[
            styles.rowLabel,
            { color: isDestructive ? '#ff4d4d' : theme.text }
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      </View>

      <View style={styles.rowRight}>
        {value && <Text style={[styles.rowValue, { color: theme.muted }]}>{value}</Text>}

        {isSwitch ? (
          <View pointerEvents="none">
            <Switch
              value={switchValue}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor={"#fff"}
            />
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={theme.muted} style={{ marginLeft: 6, opacity: 0.5 }} />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function SettingScreen() {
  const router = useRouter();
  const { theme, dark } = useTheme();
  const { userData, refreshData } = useData();
  const confettiRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [incomeTracking, setIncomeTracking] = useState(userData?.incomeTracking ?? true);
  const [smsAutoImport, setSmsAutoImport] = useState(userData?.smsAutoImport ?? false);
  const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);

  // Derived State
  const userName = userData?.displayName || "User";
  const userEmail = auth.currentUser?.email || "user@example.com";
  const numberEntryType = userData?.numberEntry === "type2" ? "Type 2" : "Type 1";
  const hapticsPref = userData?.haptics ? (userData.haptics.charAt(0).toUpperCase() + userData.haptics.slice(1)) : "Subtle";
  const animatedCharts = userData?.animatedCharts ?? true;
  const insightPref = userData?.insights || "Detailed";

  useEffect(() => {
    const loadLocalPrefs = async () => {
      const bioPref = await AsyncStorage.getItem("biometric_enabled");
      setBiometricEnabled(bioPref === "true");
    };
    loadLocalPrefs();
  }, []);

  useEffect(() => {
    if (userData?.incomeTracking !== undefined) {
      setIncomeTracking(userData.incomeTracking);
    }
    if (userData?.smsAutoImport !== undefined) {
      setSmsAutoImport(userData.smsAutoImport);
    }
  }, [userData]);

  useEffect(() => {
    checkSmsPermissionStatus();
  }, []);

  const checkSmsPermissionStatus = async () => {
    const granted = await checkSmsPermissions();
    setSmsPermissionGranted(granted);
  };

  // --- 📤 EXPORT CSV ---
  const exportCSV = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return Alert.alert("Error", "Not logged in.");

      setLoading(true);
      setLoadingText("Generating CSV...");

      const txRef = collection(db, "users", user.uid, "transactions");
      const txSnap = await getDocs(txRef);
      const transactions = txSnap.docs.map(doc => doc.data());

      const csvString = CsvService.generateCSV(transactions);
      const fileUri = FileSystem.documentDirectory + "inspend_export.csv";

      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: "utf8" });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Save CSV Export',
        UTI: 'public.comma-separated-values-text'
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Error", "Failed to generate CSV.");
    } finally {
      setLoading(false);
    }
  };

  // --- 📥 IMPORT CSV ---
  const handleImportCSV = () => {
    Alert.alert(
      "CSV Import Guide",
      "Please ensure your CSV file has the following columns:\n\nDate, Note, Amount, Type, Category, PaymentMethod\n\nExample:\n01/01/2024, Lunch, 500, Expense, Food, Cash",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Select File", onPress: importCSV }
      ]
    );
  };

  const importCSV = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "text/plain"],
        copyToCacheDirectory: true
      });

      if (pick.canceled || !pick.assets) return;

      setLoading(true);
      setLoadingText("Parsing CSV...");

      const uri = pick.assets[0].uri;
      const csvContent = await FileSystem.readAsStringAsync(uri, { encoding: "utf8" });

      const userCategories = [...(userData.categories || []), ...(userData.incomeCategories || [])];
      
      const { transactions, newCategories } = CsvService.parseCSV(csvContent, userCategories);

      // --- AI BATCH PROCESSING ---
      const uncertain = transactions
        .map((t, i) => ({ ...t, originalIndex: i }))
        .filter(t => t.category.label === "General");

      if (uncertain.length > 0) {
        setLoadingText(`AI Categorizing (${uncertain.length})...`);
        const inputs = uncertain.map(t => ({ description: t.note, amount: t.amount }));
        const predictedLabels = await AICategorizationService.predictCategoriesBatch(inputs, [...userCategories, ...newCategories]);
        
        uncertain.forEach((t, i) => {
            const label = predictedLabels[i];
            if (label && label !== "General") {
                const cat = [...userCategories, ...newCategories].find(c => c.label === label);
                if (cat) {
                    transactions[t.originalIndex].category = cat;
                }
            }
        });
      }

      // Add New Categories to User Profile
      if (newCategories.length > 0) {
        const user = auth.currentUser;
        if (user) {
             const userRef = doc(db, "users", user.uid);
             const currentExpenses = userData.categories || [];
             
             await updateDoc(userRef, {
                 categories: [...currentExpenses, ...newCategories]
             });
        }
      }

      setLoadingText("Saving Data...");
      const user = auth.currentUser;
      if (!user) return;
      const batch = writeBatch(db);
      const txRef = collection(db, "users", user.uid, "transactions");

      transactions.forEach(t => {
        const newRef = doc(txRef);
        batch.set(newRef, t);
      });

      await batch.commit();
      await refreshData();
      
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (confettiRef.current) confettiRef.current.start();
      
      setTimeout(() => {
        Alert.alert("Success", `Imported ${transactions.length} transactions!`);
      }, 500);

    } catch (e: any) {
      setLoading(false);
      Alert.alert("Import Failed", e.message || "Invalid CSV format.");
    }
  };

  // --- OTHER ACTIONS ---
  const toggleIncomeTracking = async (value: boolean) => {
    setIncomeTracking(value);
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), { incomeTracking: value }, { merge: true });
        await refreshData();
      }
    } catch (e) {
      setIncomeTracking(!value);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    setBiometricEnabled(value);
    await AsyncStorage.setItem("biometric_enabled", value ? "true" : "false");
  };

  const toggleAnimatedCharts = async (value: boolean) => {
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), { animatedCharts: value }, { merge: true });
        await refreshData();
      }
    } catch (e) { }
  };

  const toggleSmsAutoImport = async (value: boolean) => {
    if (value) {
      const granted = await requestSmsPermissions();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "SMS permissions are required to automatically import transactions from your SMS messages.",
          [{ text: "OK" }]
        );
        return;
      }
      setSmsPermissionGranted(true);
    }

    setSmsAutoImport(value);
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), { smsAutoImport: value }, { merge: true });
        await refreshData();
      }
    } catch (e) {
      setSmsAutoImport(!value);
    }
  };

  const handleSyncSms = async () => {
    try {
      const hasPermission = await checkSmsPermissions();
      if (!hasPermission) {
        const granted = await requestSmsPermissions();
        if (!granted) {
          Alert.alert(
            "Permission Required",
            "SMS permissions are required to import transactions.",
            [{ text: "OK" }]
          );
          return;
        }
        setSmsPermissionGranted(true);
      }

      setLoading(true);
      setLoadingText("Reading SMS messages...");

      const categories = userData?.categories || [];
      const result = await syncSmsTransactions(categories);

      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.success > 0 || result.failed > 0) {
        Alert.alert(
          "SMS Sync Complete",
          `✅ ${result.success} transaction(s) imported.\n${result.failed > 0 ? `⚠️ ${result.failed} failed.` : ''}`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "No New Transactions",
          "No new transactions found in your SMS messages.",
          [{ text: "OK" }]
        );
      }
    } catch (error: any) {
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Sync Failed",
        error.message || "Could not sync SMS transactions. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const performErase = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      setLoading(true);
      setLoadingText("Erasing Data...");
      const transactionsRef = collection(db, "users", user.uid, "transactions");
      const snapshot = await getDocs(transactionsRef);
      if (snapshot.empty) {
        setLoading(false);
        Alert.alert("Empty", "No transactions to delete.");
        return;
      }
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      await refreshData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "All transaction history has been permanently deleted.");
    } catch (error) {
      Alert.alert("Error", "Could not erase data.");
    } finally {
      setLoading(false);
    }
  };

  const handleErase = () => {
    if (loading) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Erase All Data", "Are you sure? This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete Everything", style: "destructive", onPress: performErase }]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={{ marginTop: 10, color: '#fff', fontWeight: '600' }}>{loadingText || "Processing..."}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* PROFILE */}
        <TouchableOpacity style={[styles.profileCard, { backgroundColor: theme.card }]} onPress={() => router.push("/setting/profilemanagement")} activeOpacity={0.9}>
          <View style={[styles.avatar, { backgroundColor: theme.accent, shadowColor: theme.accent }]}>
            <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>{userName}</Text>
            <Text style={[styles.profileEmail, { color: theme.muted }]}>{userEmail}</Text>
            <View style={[styles.editBadge, { backgroundColor: theme.accent + '20' }]}>
              <Text style={{ fontSize: 11, color: theme.accent, fontWeight: '700' }}>Edit Profile</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={theme.muted} style={{ opacity: 0.3 }} />
        </TouchableOpacity>

        {/* 1. GENERAL PREFERENCES */}
        <Text style={[styles.sectionHeader, { color: theme.muted }]}>GENERAL</Text>
        <View style={[styles.sectionContainer, { backgroundColor: theme.card }]}>
          <SettingRow icon="moon" color="#6366f1" label="Appearance" value={dark ? "Dark" : "Light"} onPress={() => router.push("/setting/theme")} />
          <SettingRow icon="finger-print" color="#8b5cf6" label="Biometric Lock" isSwitch switchValue={biometricEnabled} onToggle={toggleBiometric} />
          <SettingRow icon="notifications" color="#f59e0b" label="Notifications" onPress={() => router.push("/setting/notifications")} />
          <SettingRow icon="phone-portrait" color="#06b6d4" label="Haptics" value={hapticsPref} onPress={() => router.push("/setting/haptics")} isLast />
        </View>

        {/* 2. CONFIGURATION */}
        <Text style={[styles.sectionHeader, { color: theme.muted }]}>CONFIGURATION</Text>
        <View style={[styles.sectionContainer, { backgroundColor: theme.card }]}>
          <SettingRow icon="wallet" color="#22c55e" label="Income Tracking" isSwitch switchValue={incomeTracking} onToggle={toggleIncomeTracking} />
          <SettingRow icon="grid" color="#f97316" label="Categories" onPress={() => router.push("/setting/categories")} />
          <SettingRow icon="keypad" color="#ef4444" label="Number Entry Style" value={numberEntryType} onPress={() => router.push("/setting/numberentry")} />
          <SettingRow icon="bulb" color="#8b5cf6" label="Insight Preference" value={insightPref} onPress={() => router.push("/setting/insights")} />
          <SettingRow icon="pie-chart" color="#10b981" label="Animated Charts" isSwitch switchValue={animatedCharts} onToggle={toggleAnimatedCharts} />
          <SettingRow
            icon="chatbubbles"
            color="#06b6d4"
            label="SMS Auto-Import"
            isSwitch
            switchValue={smsAutoImport}
            onToggle={toggleSmsAutoImport}
            isLast
          />
        </View>

        {/* 2.5 SMS SYNC */}
        {smsPermissionGranted && (
          <>
            <Text style={[styles.sectionHeader, { color: theme.muted }]}>SMS SYNC</Text>
            <View style={[styles.sectionContainer, { backgroundColor: theme.card }]}>
              <SettingRow
                icon="sync"
                color="#3b82f6"
                label="Sync SMS Now"
                onPress={handleSyncSms}
                isLast
              />
            </View>
          </>
        )}

        {/* 3. EXPORT & DATA (JSON Removed) */}
        <Text style={[styles.sectionHeader, { color: theme.muted }]}>DATA MANAGEMENT</Text>
        <View style={[styles.sectionContainer, { backgroundColor: theme.card }]}>
          <SettingRow icon="download-outline" color="#8b5cf6" label="Import Data" onPress={handleImportCSV} />
          <SettingRow icon="share-outline" color="#f59e0b" label="Export Data" onPress={exportCSV} />
          <SettingRow icon="trash" color="#ef4444" label="Erase Data" onPress={handleErase} isLast isDestructive />
        </View>

        {/* 4. ABOUT */}
        <Text style={[styles.sectionHeader, { color: theme.muted }]}>ABOUT</Text>
        <View style={[styles.sectionContainer, { backgroundColor: theme.card }]}>
          <SettingRow icon="shield-checkmark" color="#64748b" label="Privacy Policy" onPress={() => { }} />
          <SettingRow icon="heart" color="#f43f5e" label="Rate InSpend" onPress={() => { }} isLast />
        </View>

        <Text style={[styles.versionText, { color: theme.muted }]}>InSpend v1.0.3 • Made with 💜</Text>
      </ScrollView>

      <ConfettiCannon count={200} origin={{ x: -10, y: 0 }} autoStart={false} ref={confettiRef} fadeOut={true} fallSpeed={3000} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 15 },
  headerTitle: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  avatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowOpacity: 0.3, shadowRadius: 8 },
  avatarText: { fontSize: 26, color: '#fff', fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  profileEmail: { fontSize: 13, opacity: 0.8, marginBottom: 6 },
  editBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  sectionHeader: { fontSize: 12, fontWeight: '700', marginTop: 20, marginBottom: 10, marginLeft: 10, letterSpacing: 1, opacity: 0.8 },
  sectionContainer: { borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, paddingRight: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 15, marginRight: 8 },
  versionText: { textAlign: 'center', fontSize: 12, marginTop: 30, fontWeight: '500', opacity: 0.6 }
});