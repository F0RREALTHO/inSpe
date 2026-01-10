import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { collection, doc, writeBatch } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    DeviceEventEmitter,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { auth, db } from "../firebaseConfig";
import CustomToast from "./components/CustomToast";
import { useTheme } from "./context/ThemeContext";
// ✅ IMPORT USE DATA
import { useData } from "./context/DataProvider";

import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { AnimatedNumberDisplay } from "../components/AnimatedInput/AnimatedNumberDisplay";
import { InputButton } from "../components/AnimatedInput/InputButton";
import { NotificationService } from "./utils/NotificationService";
import { RateLimiter, TransactionSchema } from "./utils/Security";

const { width } = Dimensions.get("window");
const KEY_WIDTH = (width - 48) / 3;
const RECURRING_OPTIONS = ["none", "daily", "weekly", "monthly", "custom"];
const PAYMENT_METHODS = ["UPI", "Card", "Bank", "Wallet", "Cash"];

export default function AddTransactionScreen() {
  const router = useRouter();
  const { theme, dark } = useTheme();
  
  // ✅ GLOBAL DATA
  const { transactions, userData } = useData(); 

  // --- STATE ---
  const [type, setType] = useState<"expense" | "income">("expense");
  const [inputVal, setInputVal] = useState("");
  const [entryMethod, setEntryMethod] = useState<"type1" | "type2">("type2");
  
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  const [budgetStyle, setBudgetStyle] = useState<string>("Flexible");
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0);
  const [notifPref, setNotifPref] = useState<string>("Never");

  // UI State
  const [categoryError, setCategoryError] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as "success" | "error" | "info" });
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [recurringMenuVisible, setRecurringMenuVisible] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState("none");
  const [loading, setLoading] = useState(false);

  const fadeAnim = useSharedValue(0); 
  const slideAnim = useSharedValue(50); 

  // ✅ INSTANT CALCULATION: Total Spent This Month
  const currentMonthSpent = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      return transactions
          .filter(t => {
              const d = new Date(t.date);
              return t.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  // ✅ INSTANT CALCULATION: Current Bank Balance (Income - Expenses for the month)
  const currentMonthIncome = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      return transactions
          .filter(t => {
              const d = new Date(t.date);
              return t.type === 'income' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  // ✅ SAFE TO SPEND = MIN(actual_balance, budget_remaining)
  const currentBalance = currentMonthIncome - currentMonthSpent;

  const showToast = (msg: string, type: "success" | "error" | "info") => {
      setToast({ visible: true, message: msg, type });
  };

  useEffect(() => {
    if (showCategoryPicker) {
        fadeAnim.value = withTiming(1, { duration: 200 });
        slideAnim.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    } else {
        fadeAnim.value = withTiming(0, { duration: 150 });
        slideAnim.value = withTiming(50, { duration: 150 });
    }
  }, [showCategoryPicker]);

  const rOverlayStyle = useAnimatedStyle(() => {
    return {
        opacity: fadeAnim.value,
        transform: [{ translateY: slideAnim.value }]
    };
  });

  // ✅ Load Settings from Global UserData
  useEffect(() => {
      if (userData) {
          if (userData.numberEntry) setEntryMethod(userData.numberEntry);
          setExpenseCategories(userData.categories || []);
          setIncomeCategories(userData.incomeCategories || []);
          
          const style = userData.budgetStyle || userData.budgetMode || "Flexible";
          setBudgetStyle(style);
          
          const limit = typeof userData.monthlyLimit === 'number' ? userData.monthlyLimit : parseFloat(userData.monthlyLimit) || 0;
          setMonthlyLimit(limit);

          if (userData.notification) setNotifPref(userData.notification);
      }
  }, [userData]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const currentCategoryList = type === 'expense' ? expenseCategories : incomeCategories;
  const isListEmpty = currentCategoryList.length === 0;

  const getDisplayAmount = () => {
    if (entryMethod === "type1") {
      if (!inputVal) return "0.00";
      const num = parseInt(inputVal, 10);
      return (num / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      if (!inputVal) return "0";
      const [intPart, decPart] = inputVal.split('.');
      const formattedInt = parseInt(intPart || "0", 10).toLocaleString('en-IN');
      if (decPart !== undefined) {
          return `${formattedInt}.${decPart}`;
      }
      return formattedInt;
    }
  };

  const handlePress = (key: string) => {
    if (key === "backspace") { 
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setInputVal((prev) => prev.slice(0, -1)); 
        return; 
    }
    
    if (key === "check") { 
        checkBudgetAndSubmit(); 
        return; 
    }
    
    const currentDigits = inputVal.replace('.', '');
    if (currentDigits.length >= 8) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === ".") {
      if (entryMethod === "type1") return; 
      if (inputVal.includes(".")) return;
      setInputVal((prev) => (prev || "0") + ".");
      return;
    }
    
    if (entryMethod === "type1") {
      setInputVal((prev) => prev + key);
    } else {
      if (inputVal === "0" && key !== ".") setInputVal(key);
      else setInputVal((prev) => prev + key);
    }
  };

  const handleCategoryPress = () => {
      setCategoryError(false); 
      if (isListEmpty) {
          router.push({ pathname: "/setting/categories", params: { initialTab: type } });
      } else {
          setShowCategoryPicker(!showCategoryPicker);
      }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    if (Platform.OS === 'android') setShowDatePicker(false);
    setDate(currentDate);
  };

  // --- 🛑 BUDGET LOGIC ---
  const checkBudgetAndSubmit = async () => {
    const rawAmount = parseFloat(getDisplayAmount().replace(/,/g, ''));
    
    // Zod Validation
    const valResult = TransactionSchema.safeParse({
        amount: rawAmount,
        description: note || "Manual Entry", // Default description if empty
        category: selectedCategory?.label
    });

    if (!valResult.success) {
        const errMsg = valResult.error.errors[0].message;
        showToast(errMsg, "error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
    }

    if (!selectedCategory) {
        setCategoryError(true);
        showToast("Please select a category", "error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
    }

    // Rate Check
    try {
        await RateLimiter.checkLimit("TRANSACTION_ADD");
    } catch (e: any) {
        showToast(e.message, "error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
    }

    const label = selectedCategory.label.toLowerCase();
    const isEssential = ["healthcare", "medical", "emergency", "medicine", "doctor", "hospital"].some(
        key => label.includes(key)
    );

    if (isEssential) {
        if (monthlyLimit > 0 && (currentMonthSpent + rawAmount) > monthlyLimit) {
            showToast("Health comes first ❤️", "success");
        }
        processTransaction(rawAmount);
        return;
    }

    if (type === 'expense') {
        const style = budgetStyle.toLowerCase(); 
        const projectedTotal = currentMonthSpent + rawAmount;

        if (monthlyLimit > 0 && projectedTotal > monthlyLimit) {
            if (style === 'strict') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(
                    "🛑 STOP RIGHT THERE!",
                    `You have a STRICT limit of ₹${monthlyLimit.toLocaleString('en-IN')} and this puts you over!`,
                    [
                        { text: "I'll Cancel", style: "cancel" },
                        { 
                            text: "Add Anyway (Shame)", 
                            style: "destructive", 
                            onPress: () => processTransaction(rawAmount) 
                        }
                    ]
                );
                return; 
            }

            if (style === 'flexible') {
                Alert.alert(
                    "Budget Warning ⚠️",
                    `This transaction exceeds your monthly limit of ₹${monthlyLimit.toLocaleString('en-IN')}.`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Confirm", onPress: () => processTransaction(rawAmount) }
                    ]
                );
                return;
            }
        }
    }

    processTransaction(rawAmount);
  };

  const processTransaction = async (amount: number) => {
    setLoading(true);

    try {
        const user = auth.currentUser;
        if (!user) return;

        const batch = writeBatch(db);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let loopDate = new Date(date);
        loopDate.setHours(0, 0, 0, 0);

        if (recurringFreq !== "none") {
            // Create template for future occurrences
            const templateRef = doc(collection(db, "users", user.uid, "transactions"));
            batch.set(templateRef, {
                type, amount, category: selectedCategory, 
                date: date.toISOString(), note: note.trim(),
                paymentMethod, recurring: recurringFreq, 
                createdAt: new Date().toISOString()
            });
            
            // Backfill history: create individual transactions for past occurrences
            loopDate = new Date(date);
            loopDate.setHours(0, 0, 0, 0);
            
            while (loopDate < now) {
                const histRef = doc(collection(db, "users", user.uid, "transactions"));
                batch.set(histRef, {
                    type, amount, category: selectedCategory, 
                    date: loopDate.toISOString(), note: note.trim(),
                    paymentMethod, recurring: null, createdAt: new Date().toISOString()
                });

                if (recurringFreq === "daily") loopDate.setDate(loopDate.getDate() + 1);
                else if (recurringFreq === "weekly") loopDate.setDate(loopDate.getDate() + 7);
                else if (recurringFreq === "monthly") loopDate.setMonth(loopDate.getMonth() + 1);
                else break;

                if (loopDate.getFullYear() < 2020) break; 
            }
        } else {
            // Non-recurring: just add single transaction
            const singleRef = doc(collection(db, "users", user.uid, "transactions"));
            batch.set(singleRef, {
                type, amount, category: selectedCategory, 
                date: date.toISOString(), note: note.trim(),
                paymentMethod, recurring: null, createdAt: new Date().toISOString()
            });
        }

        await batch.commit();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // ✅ TRIGGER NOTIFICATION IF CONDITIONS MET
        if (type === 'expense' && notifPref === 'When I overspend') {
            if (monthlyLimit > 0) {
                // 🔧 FIX: Only trigger notification if the expense is from the current month
                const transactionDate = new Date(date);
                const now = new Date();
                const isCurrentMonth = transactionDate.getMonth() === now.getMonth() && 
                                       transactionDate.getFullYear() === now.getFullYear();
                
                if (isCurrentMonth) {
                    const newBalance = currentBalance - amount; // After this transaction
                    const limitRemaining = monthlyLimit - (currentMonthSpent + amount);
                    
                    // Safe to spend = MIN(actual balance, budget remaining)
                    const safeToSpend = Math.min(newBalance, limitRemaining);
                    
                    // 🔧 FIX: Use customizable threshold from userData or default to 1000
                    const notificationThreshold = userData?.notificationThreshold || 1000;
                    
                    console.log("📊 Overspend Check:", { 
                        monthlyLimit, 
                        currentBalance,
                        spent: currentMonthSpent + amount,
                        limitRemaining,
                        newBalance,
                        safeToSpend,
                        threshold: notificationThreshold,
                        isCurrentMonth
                    });
                    
                    if (safeToSpend < notificationThreshold) {
                        console.log("✅ Notification triggered: Safe to spend <", notificationThreshold);
                        await NotificationService.triggerOverspendAlert(safeToSpend);
                        showToast(`⚠️ Only ₹${Math.max(0, safeToSpend).toLocaleString('en-IN')} safe to spend!`, 'info');
                    } else {
                        console.log("ℹ️ Safe to spend >=", notificationThreshold, ": No alert (budget is healthy)");
                    }
                } else {
                    console.log("ℹ️ Expense is from a past month - skipping notification");
                }
            } else {
                console.log("⚠️ No monthly limit set - skipping overspend check");
            }
        }

        DeviceEventEmitter.emit('TRANSACTION_ADDED');
        handleBack();

    } catch (e) {
        console.error(e);
        showToast("Save failed.", "error");
    } finally {
        setLoading(false);
    }
  };

  const renderGridKey = (label: string, value: string) => (
    <View style={{ width: KEY_WIDTH, height: 60 }}>
        <InputButton 
            label={label}
            onPress={() => handlePress(value)}
            style={{ backgroundColor: '#1c1c1e' }} 
            textStyle={{ color: '#fff', fontSize: 26 }}
        />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={[styles.iconBtn, { backgroundColor: theme.card }]}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <View style={[styles.toggleContainer, { backgroundColor: theme.card }]}>
            <TouchableOpacity 
                style={[styles.toggleBtn, type === "expense" && { backgroundColor: theme.text }]} 
                onPress={() => {
                    if (type !== "expense") {
                        setType("expense");
                        setSelectedCategory(null);
                        setCategoryError(false);
                        setShowCategoryPicker(false);
                    }
                }}
            >
                <Text style={[styles.toggleText, {color: type === "expense" ? theme.bg : theme.muted}]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.toggleBtn, type === "income" && { backgroundColor: theme.text }]} 
                onPress={() => {
                    if (type !== "income") {
                        setType("income");
                        setSelectedCategory(null);
                        setCategoryError(false);
                        setShowCategoryPicker(false);
                    }
                }}
            >
                <Text style={[styles.toggleText, {color: type === "income" ? theme.bg : theme.muted}]}>Income</Text>
            </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setRecurringMenuVisible(true)} style={[styles.iconBtn, { backgroundColor: theme.card }]}>
          <Ionicons name="repeat" size={24} color={recurringFreq !== 'none' ? theme.accent : theme.text} />
        </TouchableOpacity>
      </View>

      {/* DISPLAY */}
      <View style={styles.displayArea}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={[styles.currency, { color: theme.muted }]}>₹</Text>
            <View style={{ minWidth: 100, height: 60, justifyContent: 'center' }}>
                <AnimatedNumberDisplay 
                    value={getDisplayAmount()} 
                    style={[styles.amount, { color: theme.text }]}
                />
            </View>
        </View>
        
        {inputVal.length > 0 && (
             <TouchableOpacity 
                onPress={() => handlePress("backspace")} 
                style={styles.backspaceBtn}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            >
                <Ionicons name="backspace" size={28} color={theme.text} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
        )}
      </View>

      {/* PAYMENT METHOD */}
      <View style={styles.paymentRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 20}}>
            {PAYMENT_METHODS.map((method) => {
                const isActive = paymentMethod === method;
                return (
                    <TouchableOpacity 
                        key={method} 
                        style={[
                            styles.paymentChip, 
                            { borderColor: theme.card }, 
                            isActive && { backgroundColor: theme.text, borderColor: theme.text } 
                        ]}
                        onPress={() => setPaymentMethod(method)}
                    >
                        <Text style={[styles.paymentText, { color: isActive ? theme.bg : theme.muted }]}>{method}</Text>
                    </TouchableOpacity>
                )
            })}
        </ScrollView>
      </View>

      {/* INPUTS */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <TouchableOpacity style={[styles.inputPill, { backgroundColor: theme.card }]}>
            <Ionicons name="text" size={16} color={theme.text} style={{marginRight: 8, opacity: 0.7}} />
            <TextInput 
                placeholder="Add Note" 
                placeholderTextColor={theme.muted}
                value={note}
                onChangeText={setNote}
                style={{ color: theme.text, fontSize: 15, fontWeight: '500', minWidth: 80 }}
            />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity 
            style={[styles.inputPill, { backgroundColor: theme.card, flex: 1, marginRight: 10, justifyContent: 'center' }]} 
            onPress={() => setShowDatePicker(true)}
        >
            <Ionicons name="calendar" size={16} color={theme.text} style={{ opacity: 0.7 }} />
            <Text style={{ color: theme.text, marginLeft: 8, fontSize: 14, fontWeight: '600' }}>
                {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
            </Text>
        </TouchableOpacity>

        <TouchableOpacity 
            style={[
                styles.inputPill, 
                { 
                    flex: 1, 
                    marginLeft: 10, 
                    justifyContent: 'center',
                    backgroundColor: categoryError ? '#ef444433' : (selectedCategory ? selectedCategory.color + '25' : theme.card),
                    borderColor: categoryError ? '#ef4444' : (selectedCategory ? selectedCategory.color : 'transparent'),
                    borderWidth: selectedCategory || categoryError ? 1 : 0
                }
            ]} 
            onPress={handleCategoryPress}
        >
            {categoryError ? (
                <>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={{ color: "#ef4444", marginLeft: 6, fontSize: 13, fontWeight: 'bold' }}>Missing</Text>
                </>
            ) : selectedCategory ? (
                <>
                    <Text style={{marginRight: 6}}>{selectedCategory.emoji}</Text>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{selectedCategory.label}</Text>
                </>
            ) : (
                <>
                    <Ionicons name="grid-outline" size={16} color={theme.text} style={{ opacity: 0.7 }} />
                    <Text style={{ color: theme.text, marginLeft: 8, fontSize: 14, fontWeight: '600' }}>Category</Text>
                </>
            )}
        </TouchableOpacity>
      </View>

      {/* KEYPAD */}
      <View style={styles.bottomSection}>
        <View style={styles.keypad}>
            <View style={styles.row}>
                {renderGridKey("1", "1")}
                {renderGridKey("2", "2")}
                {renderGridKey("3", "3")}
            </View>
            <View style={styles.row}>
                {renderGridKey("4", "4")}
                {renderGridKey("5", "5")}
                {renderGridKey("6", "6")}
            </View>
            <View style={styles.row}>
                {renderGridKey("7", "7")}
                {renderGridKey("8", "8")}
                {renderGridKey("9", "9")}
            </View>
            <View style={styles.row}>
                {entryMethod === "type2" ? (
                   renderGridKey(".", ".")
                ) : (
                   <View style={{ width: KEY_WIDTH, height: 60 }} />
                )}
                
                {renderGridKey("0", "0")}
                
                {/* Submit Button */}
                <View style={{ width: KEY_WIDTH, height: 60, alignItems: 'center', justifyContent: 'center' }}>
                    <InputButton 
                        label="check"
                        onPress={() => handlePress("check")}
                        style={{ backgroundColor: '#3a3a3c', zIndex: 10 }} 
                        textStyle={{ color: '#fff' }}
                    />
                </View>
            </View>
        </View>

        {showCategoryPicker && !isListEmpty && (
            <Animated.View style={[
                styles.overlayContainer, 
                rOverlayStyle,
                { 
                    backgroundColor: dark ? 'rgba(20,20,20,0.98)' : 'rgba(255,255,255,0.98)', 
                }
            ]}>
                <View style={styles.overlayHeader}>
                    <Text style={{color: theme.muted, fontSize: 13, fontWeight: 'bold'}}>SELECT {type.toUpperCase()}</Text>
                    <TouchableOpacity onPress={() => setShowCategoryPicker(false)} style={[styles.closeOverlayBtn, { backgroundColor: theme.card }]}>
                        <Ionicons name="close" size={20} color={theme.text} />
                    </TouchableOpacity>
                </View>

                <FlatList 
                    data={currentCategoryList}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    contentContainerStyle={{paddingHorizontal: 10, paddingBottom: 60}}
                    renderItem={({item}) => (
                        <TouchableOpacity 
                            style={[
                                styles.gridItem, 
                                { backgroundColor: theme.card },
                                selectedCategory?.id === item.id && { borderColor: theme.accent, borderWidth: 1 }
                            ]}
                            onPress={() => { 
                                setSelectedCategory(item); 
                                setShowCategoryPicker(false); 
                            }}
                        >
                            <Text style={{fontSize: 28, marginBottom: 5}}>{item.emoji}</Text>
                            <Text style={{color: theme.text, fontSize: 12, fontWeight: '600'}} numberOfLines={1}>{item.label}</Text>
                        </TouchableOpacity>
                    )}
                />

                <TouchableOpacity 
                    style={[styles.bottomEditBtn, { backgroundColor: theme.card }]} 
                    onPress={() => router.push({
                        pathname: "/setting/categories",
                        params: { initialTab: type } 
                    })}
                >
                    <Ionicons name="settings-outline" size={16} color={theme.text} style={{marginRight: 6}} />
                    <Text style={{color: theme.text, fontWeight: 'bold'}}>Edit Categories</Text>
                </TouchableOpacity>
            </Animated.View>
        )}
      </View>

      {/* DATE PICKER & MODAL & TOAST */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
            <Modal transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.pickerBox, { backgroundColor: theme.card }]}>
                        <DateTimePicker value={date} mode="date" display="inline" onChange={onDateChange} themeVariant={dark ? "dark" : "light"} />
                        <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: theme.bg }]} onPress={() => setShowDatePicker(false)}>
                            <Text style={{color: theme.text, fontWeight: 'bold'}}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        ) : (
            <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
        )
      )}

      <Modal visible={recurringMenuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setRecurringMenuVisible(false)}>
            <View style={styles.modalOverlay}>
                <View style={[styles.menuBox, { backgroundColor: theme.card }]}>
                    {RECURRING_OPTIONS.map((opt) => (
                        <TouchableOpacity 
                            key={opt} 
                            style={[styles.menuItem, { borderBottomColor: theme.bg }]}
                            onPress={() => { setRecurringFreq(opt); setRecurringMenuVisible(false); }}
                        >
                            <Text style={{color: theme.text, fontSize: 16, textTransform: 'capitalize'}}>{opt}</Text>
                            {recurringFreq === opt && <Ionicons name="checkmark" size={18} color={theme.text} />}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </TouchableWithoutFeedback>
      </Modal>

      <CustomToast 
        visible={toast.visible} 
        message={toast.message} 
        type={toast.type}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 },
  iconBtn: { padding: 10, borderRadius: 20 },
  toggleContainer: { flexDirection: 'row', borderRadius: 20, padding: 4 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16 },
  toggleText: { fontWeight: '600', fontSize: 14 },
  displayArea: { alignItems: 'center', justifyContent: 'center', marginTop: 20, flexDirection: 'row', position: 'relative', height: 80 },
  currency: { fontSize: 32, fontWeight: '600', marginRight: 4, marginTop: 8 },
  amount: { fontSize: 56, fontWeight: '400' },
  backspaceBtn: { position: 'absolute', right: 20, padding: 10 },
  paymentRow: { height: 50, marginBottom: 15, marginTop: 10 },
  paymentChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 10, justifyContent: 'center' },
  paymentText: { fontSize: 13, fontWeight: '600' },
  inputPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 20 },
  bottomSection: { flex: 1, marginHorizontal: 16, position: 'relative' },
  keypad: { gap: 12, paddingBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  overlayContainer: { ...StyleSheet.absoluteFillObject, borderRadius: 20, padding: 16, zIndex: 10 },
  overlayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  closeOverlayBtn: { padding: 4, borderRadius: 12 },
  gridItem: { width: '30%', margin: '1.5%', aspectRatio: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bottomEditBtn: { position: 'absolute', bottom: 10, left: 20, right: 20, paddingVertical: 12, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: { padding: 20, borderRadius: 20, width: '90%', alignSelf: 'center' },
  modalCloseBtn: { marginTop: 15, padding: 10, borderRadius: 10, alignItems: 'center' },
  menuBox: { position: 'absolute', top: 60, right: 20, width: 160, borderRadius: 12, padding: 8 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 0.5 },
});