import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useData } from "./../context/DataProvider";
import { useTheme } from "./../context/ThemeContext";

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { generateHTML } from '../utils/htmlGenerator';
import {
  calculateBurnRate,
  calculateMonthComparison,
  getBestSavingDay,
  getBiggestExpense,
  getCategoryAlerts,
  type BestSavingDay,
  type BiggestExpense,
  type BurnRatePrediction,
  type CategoryAlert,
  type MonthComparison,
} from '../utils/InsightCalculations';
import { ChatMessageSchema, RateLimiter, Sanitizer } from '../utils/Security';

import Animated, {
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GOLD_COLOR = "#FFD700";

const RAW_KEYS = process.env.EXPO_PUBLIC_GROQ_KEYS || "";
const API_KEYS = RAW_KEYS.split(",").map(k => k.trim()).filter(k => k.length > 0);

const getActiveKey = () => {
    if (API_KEYS.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * API_KEYS.length);
    return API_KEYS[randomIndex];
};

type ChartDataPoint = { id: number; label: string; fullLabel: string; value: number; };
type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string; };

const formatSmartNumber = (number: number) => {
  const absNumber = Math.abs(number);
  if (absNumber < 10000) return absNumber.toLocaleString('en-IN');
  if (absNumber >= 10000000) return (absNumber / 10000000).toFixed(2).replace(/\.00$/, '') + 'Cr';
  if (absNumber >= 100000) return (absNumber / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (absNumber >= 1000) return (absNumber / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return absNumber.toLocaleString('en-IN');
};

const getRangeDates = (range: "week" | "month" | "year") => {
  const now = new Date();
  const start = new Date(now);
  if (range === "week") {
    const day = start.getDay() || 7; 
    if (day !== 1) start.setHours(-24 * (day - 1)); 
    else start.setHours(0,0,0,0);
  } else if (range === "month") {
    start.setDate(1);
  } else {
    start.setMonth(0, 1);
  }
  start.setHours(0, 0, 0, 0);
  return start;
};

// --- 📉 UPDATED PDF GENERATOR (Rich Content) ---

// --- 📊 COMPONENT: Spring Bar ---
const SpringBar = ({ value, label, maxVal, isActive, onPress, color, width, theme, shouldAnimate }: any) => {
  const heightAnim = useSharedValue(0);
  useEffect(() => {
      const targetHeight = (value / (maxVal || 1)) * 120; 
      const finalHeight = Math.max(targetHeight, 6); 
      if (shouldAnimate) heightAnim.value = withSpring(finalHeight, { damping: 15, stiffness: 90 });
      else heightAnim.value = finalHeight;
  }, [value, maxVal, shouldAnimate]);
  const rBarStyle = useAnimatedStyle(() => ({ height: heightAnim.value, backgroundColor: isActive ? color : theme.border, opacity: isActive ? 1 : 0.4 }));
  return (
    <TouchableOpacity style={[styles.barWrapper, { width }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.barTrack}><Animated.View style={[styles.barFill, rBarStyle]} /></View>
      <Text style={[styles.barLabel, { color: isActive ? theme.text : theme.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const CategoryStrip = ({ categories, selectedCategory, onSelect, theme }: any) => {
  if (!categories || categories.length === 0) return null;
  const total = categories.reduce((sum: number, c: any) => sum + c.amount, 0);
  const palette = [theme.accent || "#D76D77", "#BF5AF2", "#FF9F0A", "#0A84FF"];
  return (
    <View style={{ marginVertical: 24 }}>
      <View style={{ flexDirection: 'row', height: 24, borderRadius: 8, overflow: 'hidden', width: '100%' }}>
        {categories.slice(0, 4).map((c: any, i: number) => {
           const color = c.color || palette[i % palette.length];
           const isSelected = selectedCategory === c.label;
           const opacity = selectedCategory && !isSelected ? 0.3 : 1;
           return (<TouchableOpacity key={i} style={[{ flex: c.amount / (total || 1), backgroundColor: color, marginRight: 2, opacity }, isSelected && { borderWidth: 2, borderColor: theme.text, borderRadius: 6, zIndex: 10 }]} activeOpacity={0.8} onPress={() => onSelect(c.label)} />);
        })}
        {total === 0 && <View style={{ flex: 1, backgroundColor: theme.cardLight || theme.card }} />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 16 }}>
        {categories.slice(0, 3).map((c: any, i: number) => {
           const color = c.color || palette[i % palette.length];
           const percent = Math.round((c.amount / (total || 1)) * 100);
           const opacity = selectedCategory && selectedCategory !== c.label ? 0.4 : 1;
           return (<TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', opacity }} onPress={() => onSelect(c.label)}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 8 }} /><Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>{c.label} <Text style={{ color: theme.text }}>{percent}%</Text></Text></TouchableOpacity>);
        })}
      </View>
    </View>
  );
};

// 📊 DETAILED INSIGHTS CARD
const DetailedInsightsCard = ({ monthComparison, biggestExpense, bestSavingDay, theme }: any) => {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[styles.insightCard, { borderColor: theme.accent, backgroundColor: theme.card, borderWidth: 1 }]}>
      {/* Month-over-Month Comparison */}
      <View style={{ marginBottom: 20 }}>
        <Text style={[styles.insightTitle, { color: theme.text }]}>📈 Month-over-Month</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <View>
            <Text style={{ color: theme.muted, fontSize: 12 }}>This Month</Text>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>₹{formatSmartNumber(monthComparison.currentMonth.expense)}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={[{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }, monthComparison.trend === 'down' ? { backgroundColor: '#00FF00' + '20' } : monthComparison.trend === 'up' ? { backgroundColor: '#FF0000' + '20' } : { backgroundColor: theme.border }]}>
              <Text style={{ color: monthComparison.trend === 'down' ? '#00FF00' : monthComparison.trend === 'up' ? '#FF0000' : theme.muted, fontSize: 13, fontWeight: '700' }}>
                {monthComparison.trend === 'down' ? '📉' : monthComparison.trend === 'up' ? '📈' : '➡️'} {Math.abs(monthComparison.expenseChange).toFixed(0)}%
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Last Month</Text>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>₹{formatSmartNumber(monthComparison.lastMonth.expense)}</Text>
          </View>
        </View>
      </View>

      {/* Biggest Expense */}
      {biggestExpense && (
        <View style={{ marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={[styles.insightTitle, { color: theme.text }]}>💸 Biggest Expense</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <View style={[{ width: 40, height: 40, borderRadius: 12, backgroundColor: biggestExpense.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }]}>
              <Text style={{ fontSize: 20 }}>💰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{biggestExpense.label}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{biggestExpense.category} • {biggestExpense.percentOfTotal.toFixed(0)}% of total</Text>
            </View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>₹{formatSmartNumber(biggestExpense.amount)}</Text>
          </View>
        </View>
      )}

      {/* Best Saving Day */}
      {bestSavingDay && (
        <View style={{ marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={[styles.insightTitle, { color: theme.text }]}>🎯 Best Saving Day</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <View>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Lowest spending</Text>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>{bestSavingDay.dayName}, {bestSavingDay.date}</Text>
            </View>
            <View style={{ backgroundColor: '#00FF00' + '20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
              <Text style={{ color: '#00FF00', fontSize: 16, fontWeight: '700' }}>₹{formatSmartNumber(bestSavingDay.spent)}</Text>
            </View>
          </View>
        </View>
      )}


    </Animated.View>
  );
};

// 🤖 AI INSIGHTS CARD
const AIInsightsCard = ({ burnRate, categoryAlerts, theme }: any) => {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[styles.insightCard, { borderColor: theme.accent, backgroundColor: theme.card, borderWidth: 1 }]}>
      {/* Burn Rate Prediction */}
      <View style={{ marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text style={[styles.insightTitle, { color: theme.text }]}>🔥 Burn Rate Prediction</Text>
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Daily Average:</Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>₹{formatSmartNumber(burnRate.dailyAverage)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Projected Total:</Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>₹{formatSmartNumber(burnRate.projectedTotal)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Monthly Limit:</Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>₹{formatSmartNumber(burnRate.monthlyLimit)}</Text>
          </View>
          {burnRate.willExceed && (
            <View style={{ backgroundColor: '#FF0000' + '20', padding: 12, borderRadius: 12, marginTop: 8 }}>
              <Text style={{ color: '#FF0000', fontSize: 13, fontWeight: '700' }}>
                ⚠️ Will exceed by ₹{formatSmartNumber(burnRate.excessAmount)} in {burnRate.daysLeftInMonth} days
              </Text>
            </View>
          )}
          {!burnRate.willExceed && (
            <View style={{ backgroundColor: '#00FF00' + '20', padding: 12, borderRadius: 12, marginTop: 8 }}>
              <Text style={{ color: '#00FF00', fontSize: 13, fontWeight: '700' }}>
                ✅ On track! Budget remaining: ₹{formatSmartNumber(burnRate.monthlyLimit - burnRate.projectedTotal)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Category Alerts */}
      {categoryAlerts && categoryAlerts.length > 0 && (
        <View>
          <Text style={[styles.insightTitle, { color: theme.text }]}>🚨 Smart Alerts</Text>
          {categoryAlerts.map((alert: CategoryAlert, idx: number) => (
            <View key={idx} style={{ marginTop: 10, padding: 10, backgroundColor: alert.color + '15', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: alert.color }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{alert.message}</Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
};

export default function InsightsScreen() {
  const { theme } = useTheme(); 
  const INCOME_COLOR = theme.income || "#00F0FF";
  const EXPENSE_COLOR = theme.expense || "#FF296D";
  const { transactions: allTransactions, userData, loading, refreshData } = useData();
  const [range, setRange] = useState<"week" | "month" | "year">("month");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedBarId, setSelectedBarId] = useState<number | null>(null);
  const [chartType, setChartType] = useState<"expense" | "income" | null>("expense");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); 
  const [insightPref, setInsightPref] = useState<"Minimal" | "Detailed" | "AI">("Detailed");
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const showIncome = userData?.incomeTracking ?? true;
  const userName = userData?.displayName || "User";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const chartScrollRef = useRef<ScrollView>(null);

  // 📊 NEW STATE FOR DETAILED & AI INSIGHTS
  const [monthComparison, setMonthComparison] = useState<MonthComparison | null>(null);
  const [biggestExpense, setBiggestExpense] = useState<BiggestExpense | null>(null);
  const [bestSavingDay, setBestSavingDay] = useState<BestSavingDay | null>(null);
  const [burnRate, setBurnRate] = useState<BurnRatePrediction | null>(null);
  const [categoryAlerts, setCategoryAlerts] = useState<CategoryAlert[]>([]);

  useEffect(() => {
      if (userData) {
        if (userData.insights) setInsightPref(userData.insights); else setInsightPref("Detailed");
        if (userData.animatedCharts !== undefined) setShouldAnimate(userData.animatedCharts);
      }
  }, [userData]);

  // 📊 COMPUTE INSIGHTS METRICS
  useEffect(() => {
    if (allTransactions.length === 0) return;
    
    // Calculate metrics
    const monthComp = calculateMonthComparison(allTransactions);
    setMonthComparison(monthComp);

    const biggest = getBiggestExpense(allTransactions);
    setBiggestExpense(biggest);

    const bestDay = getBestSavingDay(allTransactions);
    setBestSavingDay(bestDay);

    // AI metrics
    const burnRateData = calculateBurnRate(allTransactions, userData?.monthlyLimit || 0);
    setBurnRate(burnRateData);

    const alerts = getCategoryAlerts(allTransactions, userData?.categoryBudgets);
    setCategoryAlerts(alerts);
  }, [allTransactions, userData?.categoryBudgets, userData?.monthlyLimit]);

  useEffect(() => { if (!showIncome && chartType === 'income') setChartType('expense'); }, [showIncome, chartType]);
  useEffect(() => { if (range === 'month') setTimeout(() => { chartScrollRef.current?.scrollToEnd({ animated: shouldAnimate }); }, 100); }, [range]);

  const processedData = useMemo(() => {
    const rangeStartDate = getRangeDates(range);
    let rangeTxs = allTransactions.filter(t => new Date(t.date) >= rangeStartDate);
    let statsInc = 0; let statsExp = 0; const catMap: any = {};
    rangeTxs.forEach(t => {
        const amt = Number(t.amount);
        if(t.type === 'expense') {
            statsExp += amt;
            const cat = t.category?.label || 'Other';
            const col = t.category?.color || '#888';
            if(!catMap[cat]) catMap[cat] = { label: cat, color: col, amount: 0 };
            catMap[cat].amount += amt;
        } else { statsInc += amt; }
    });
    let displayTxs = rangeTxs;
    if (selectedCategory) displayTxs = rangeTxs.filter(t => t.category?.label === selectedCategory);
    if (selectedBarId !== null) {
        displayTxs = displayTxs.filter(t => {
            const date = new Date(t.date);
            let key = -1; 
            if (range === 'week') key = (date.getDay() + 6) % 7; 
            else if (range === 'month') key = date.getDate();
            else key = date.getMonth();
            return key === selectedBarId;
        });
    }
    if (chartType) displayTxs = displayTxs.filter(t => t.type === chartType);
    displayTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const filteredTotal = displayTxs.reduce((sum, t) => sum + Number(t.amount), 0);
    const chartMap: Record<number, ChartDataPoint> = {};
    if (range === 'week') {
        const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        days.forEach((label, i) => chartMap[i] = { id: i, label, fullLabel: fullDays[i], value: 0 });
    } else if (range === 'month') {
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        for(let i=1; i<=daysInMonth; i++) chartMap[i] = { id: i, label: String(i), fullLabel: `${i} ${new Date().toLocaleString('default', { month: 'short' })}`, value: 0 }; 
    } else {
        const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
        const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        months.forEach((label, i) => chartMap[i] = { id: i, label, fullLabel: fullMonths[i], value: 0 });
    }
    let chartSourceTxs = rangeTxs;
    if (selectedCategory) chartSourceTxs = chartSourceTxs.filter(t => t.category?.label === selectedCategory);
    chartSourceTxs.forEach(t => {
        const amt = Number(t.amount);
        if (chartType && t.type === chartType) {
            const d = new Date(t.date);
            if (range === 'week') {
                const idx = (d.getDay() + 6) % 7;
                if(chartMap[idx]) chartMap[idx].value += amt;
            } else if (range === 'month') {
                const idx = d.getDate();
                if(chartMap[idx]) chartMap[idx].value += amt;
            } else {
                const idx = d.getMonth();
                if(chartMap[idx]) chartMap[idx].value += amt;
            }
        }
    });
    return {
        stats: { income: statsInc, expense: statsExp, net: statsInc - statsExp },
        filteredTotal: filteredTotal,
        chartData: Object.values(chartMap) as ChartDataPoint[],
        categories: Object.values(catMap).sort((a:any, b:any) => b.amount - a.amount),
        displayTxs: displayTxs
    };
  }, [allTransactions, selectedBarId, range, chartType, selectedCategory]);

  const groupedTransactions = useMemo(() => {
    const grouped: any = {};
    processedData.displayTxs.forEach((t) => {
      const d = new Date(t.date);
      const today = new Date();
      let key = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
      if (d.toDateString() === today.toDateString()) key = "TODAY";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });
    return Object.entries(grouped);
  }, [processedData.displayTxs]);

  // --- 🖨️ PDF GENERATION HANDLER WITH AI SUMMARY ---
  const handleGeneratePDF = async () => {
    if (processedData.displayTxs.length === 0) {
        Alert.alert("No Data", "There are no transactions in this range to report.");
        return;
    }

    setPdfLoading(true);
    Haptics.selectionAsync();

    // 1. Fetch AI Summary
    let aiSummary = "Summary unavailable.";
    try {
        await RateLimiter.checkLimit("AI_REQUEST");
        const currentKey = getActiveKey();
        if (currentKey) {
            const income = processedData.stats.income;
            const expense = processedData.stats.expense;
            const topCategories = processedData.categories.slice(0, 3).map((c: any) => c.label).join(", ");
            const monthlyBudget = userData?.monthlyLimit || 0;
            const budgetRemaining = Math.max(0, monthlyBudget - expense);
            const budgetUtilization = monthlyBudget > 0 ? Math.round((expense / monthlyBudget) * 100) : 0;
            const budgetStyle = userData?.budgetStyle || "Flexible";
            const net = income - expense;
            
            // "Secret" API call to get a summary specifically for the PDF
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${currentKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You are an expert financial analyst. Write a 2-sentence executive summary for a PDF report." },
                        { role: "user", content: `User: ${userName}. Budget Style: ${budgetStyle}. Monthly Budget: ₹${monthlyBudget}. Income: ₹${income}. Expense: ₹${expense}. Net: ₹${net}. Budget Remaining: ₹${budgetRemaining}. Budget Utilization: ${budgetUtilization}%. Top Categories: ${topCategories}. Range: ${range}.` }
                    ],
                    max_tokens: 100
                })
            });
            const data = await response.json();
            if(data.choices) aiSummary = data.choices[0].message.content;
        }
    } catch (e) {
        console.log("AI Summary failed for PDF, skipping.");
    }

    // 2. Generate PDF
    try {
        const budgetDataForPDF = {
          monthlyLimit: userData?.monthlyLimit || 0,
          dailyAverage: burnRate?.dailyAverage || 0,
          daysLeftInMonth: burnRate?.daysLeftInMonth || 0,
          willExceed: burnRate?.willExceed || false,
          budgetStyle: userData?.budgetStyle || "Flexible"
        };
        const html = generateHTML(processedData, range, theme.accent, userName, aiSummary, budgetDataForPDF);
        const { uri } = await Print.printToFileAsync({ html });
        console.log('PDF Generated:', uri);
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
        Alert.alert("Error", "Could not generate PDF report.");
    } finally {
        setPdfLoading(false);
    }
  };

  const sendChatMessage = async (isInitial = false) => {
    if (allTransactions.length === 0) { setIsChatCollapsed(false); setMessages([{ role: 'assistant', content: "You don't have any transactions yet! 📝\n\nAdd some expenses or income, and I'll be here to analyze them for you." }]); return; }
    const currentKey = getActiveKey();
    if (!currentKey) { Alert.alert("Config Error", "No API Keys found."); return; }
    setIsChatCollapsed(false);
    const income = processedData.stats.income;
    const expense = processedData.stats.expense;
    const topCategories = processedData.categories.slice(0, 3).map((c: any) => `${c.label} (₹${c.amount})`).join(", ");
    const monthlyBudget = userData?.monthlyLimit || 0;
    const budgetRemaining = Math.max(0, monthlyBudget - expense);
    const budgetUtilization = monthlyBudget > 0 ? Math.round((expense / monthlyBudget) * 100) : 0;
    const budgetStyle = userData?.budgetStyle || "Flexible";
    const dailyAverage = burnRate?.dailyAverage || 0;
    const daysLeft = burnRate?.daysLeftInMonth || 0;
    const willExceedBudget = burnRate?.willExceed || false;
    const net = income - expense;
    const systemMessage: ChatMessage = { role: "system", content: `You are Axiom 🤖, a witty and concise financial assistant. User Profile: Budget Style=${budgetStyle}. Financial Data for ${range}: Monthly Budget: ₹${monthlyBudget}, Income: ₹${income}, Expense: ₹${expense}, Net: ₹${net}, Budget Remaining: ₹${budgetRemaining}, Budget Utilization: ${budgetUtilization}%, Daily Average Spending: ₹${dailyAverage}, Days Left: ${daysLeft}, Will Exceed: ${willExceedBudget ? 'YES ⚠️' : 'NO ✓'}, Top Categories: ${topCategories}. Rules: (1) Use Indian Rupees (₹) (2) Max 2 sentences (3) Refer to Monthly Budget for spending limit (4) Give actionable advice (5) Consider ${budgetStyle} style (6) Highlight if on/off track.` };
    let newMessages = [...messages];
    if (isInitial) {
        if (messages.length === 0) { newMessages = [systemMessage, { role: "user", content: "Give me a quick analysis." }]; setMessages([{ role: 'user', content: 'Analyzing your finances...' }]); } 
        else { const followUp: ChatMessage = { role: "user", content: "Re-analyze based on our conversation." }; newMessages.push(followUp); setMessages(prev => [...prev, followUp]); }
    } else {
        const cleanedInput = Sanitizer.sanitizeInput(inputText);
        if (!cleanedInput) return;

        // Validate input schema
        const valResult = ChatMessageSchema.safeParse({ role: 'user', content: cleanedInput });
        if (!valResult.success) {
             Alert.alert("Input Error", valResult.error.errors[0].message);
             return;
        }

        const userMsg: ChatMessage = { role: "user", content: cleanedInput };
        newMessages.push(userMsg);
        setMessages(prev => [...prev, userMsg]);
        setInputText("");
    }
    setAiLoading(true);
    try {
        await RateLimiter.checkLimit("AI_REQUEST");
        const apiMessages = [systemMessage, ...newMessages.filter(m => m.role !== 'system')];
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Authorization": `Bearer ${currentKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: apiMessages, max_tokens: 200 }) });
        const data = await response.json();
        if (data.choices && data.choices.length > 0) { const aiMsg: ChatMessage = { role: "assistant", content: data.choices[0].message.content }; setMessages(prev => [...prev, aiMsg]); } else { setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble thinking. Try again!" }]); }
    } catch (e: any) {
        let errorMsg = "Connection error.";
        if (e.message && e.message.includes("chat too fast")) errorMsg = "🛑 You're chatting too fast! Give me a minute.";
        setMessages(prev => [...prev, { role: "assistant", content: errorMsg }]);
    } finally { setAiLoading(false); }
  };

  const handleContinueChat = () => { setIsChatCollapsed(false); setTimeout(() => { inputRef.current?.focus(); }, 300); };
  const handleRangeSelect = (r: "week" | "month" | "year") => { setRange(r); setShowDropdown(false); setSelectedBarId(null); setSelectedCategory(null); setMessages([]); setIsChatCollapsed(false); };
  const toggleChartType = (type: 'income' | 'expense') => { if (shouldAnimate) Haptics.selectionAsync(); if (chartType === type) setChartType(null); else setChartType(type); };
  const handleBarPress = (id: number) => { if (shouldAnimate) Haptics.selectionAsync(); if (selectedBarId === id) setSelectedBarId(null); else setSelectedBarId(id); };
  const handleCategoryPress = (cat: string) => { if (shouldAnimate) Haptics.selectionAsync(); if (selectedCategory === cat) setSelectedCategory(null); else setSelectedCategory(cat); };
  const maxChartVal = Math.max(...processedData.chartData.map((d:any) => d.value), 1);
  const getBarWidth = () => range === 'month' ? 35 : (SCREEN_WIDTH - 40) / processedData.chartData.length;
  const selectedLabelText = useMemo(() => { if (selectedBarId === null) return null; const found = processedData.chartData.find((d) => d.id === selectedBarId); return found ? found.fullLabel : ''; }, [selectedBarId, processedData.chartData]);
  const getSubLabelText = () => { const typeLabel = chartType === 'income' ? 'INCOME' : 'SPENT'; if (selectedCategory) return `${selectedCategory.toUpperCase()} / ${range.toUpperCase()}`; if (selectedBarId !== null) return `SELECTED ${typeLabel}`; return `TOTAL ${typeLabel} / ${range.toUpperCase()}`; };
  const getAverageHeight = () => { if (!chartType) return 0; const total = processedData.chartData.reduce((sum, item) => sum + item.value, 0); const count = processedData.chartData.length || 1; const avg = total / count; if (maxChartVal === 0) return 0; return (avg / maxChartVal) * 120; };
  const averageHeight = getAverageHeight();
  const showDottedLine = chartType === 'expense' && range === 'week' && averageHeight > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData} tintColor={theme.text} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.title, { color: theme.text }]}>Insights</Text>
              
              {/* ✅ BEAUTIFIED GENERATE REPORT BUTTON */}
              {!loading && allTransactions.length > 0 && (
                  <TouchableOpacity 
                      onPress={handleGeneratePDF}
                      disabled={pdfLoading}
                      activeOpacity={0.85}
                      style={{ 
                          marginLeft: 10,
                          overflow: 'hidden',
                          borderRadius: 14
                      }}
                  >
                    <Animated.View 
                      style={{
                        backgroundColor: GOLD_COLOR + '10',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: GOLD_COLOR,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: GOLD_COLOR,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 5
                      }}
                    >
                      {pdfLoading ? (
                          <>
                            <ActivityIndicator size="small" color={GOLD_COLOR} style={{marginRight: 6}} />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD_COLOR, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                              Generating
                            </Text>
                          </>
                      ) : (
                          <>
                            <Ionicons name="sparkles" size={14} color={GOLD_COLOR} style={{marginRight: 5}} />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD_COLOR, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                              Report
                            </Text>
                          </>
                      )}
                    </Animated.View>
                  </TouchableOpacity>
              )}
          </View>

          <View>
            <TouchableOpacity style={[styles.rangeBtn, { backgroundColor: theme.card }]} onPress={() => setShowDropdown(true)}>
                <Text style={[styles.rangeText, { color: theme.text }]}>{range}</Text>
                <Ionicons name="chevron-down" size={12} color={theme.muted} style={{marginLeft: 4}} />
            </TouchableOpacity>
            
            <Modal visible={showDropdown} transparent animationType="fade">
                <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.dropdownMenu, { backgroundColor: theme.card, top: 110, right: 20 }]}>
                            {['week', 'month', 'year'].map((r) => (
                                <TouchableOpacity key={r} style={[styles.dropdownItem, range === r && { backgroundColor: theme.border }]} onPress={() => handleRangeSelect(r as any)}>
                                    <Text style={[styles.dropdownText, { color: theme.text }]}>{r}</Text>
                                    {range === r && <Ionicons name="checkmark" size={14} color={theme.text} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
          </View>
        </View>

        {loading && allTransactions.length === 0 ? (
          <ActivityIndicator size="large" color={theme.text} style={{marginTop: 50}} />
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={styles.statsRow}>
              <View>
                <Text style={[styles.label, { color: theme.muted }]}>
                    {selectedLabelText ? `SELECTED: ${selectedLabelText.toUpperCase()}` : (range === 'year' ? '2025' : range === 'month' ? 'DEC 2025' : 'THIS WEEK')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Text style={[styles.bigAmount, { color: theme.text }]}>
                    {processedData.stats.net >= 0 ? '+' : ''}₹{formatSmartNumber(Math.abs(processedData.stats.net))}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.label, { color: theme.muted }]}>{getSubLabelText()}</Text>
                <Text style={[styles.subAmount, { color: theme.text }]}>
                    ₹{formatSmartNumber(processedData.filteredTotal)}
                </Text>
              </View>
            </View>

            <View style={styles.cardRow}>
              {showIncome && (
                  <TouchableOpacity style={[styles.statCard, { backgroundColor: theme.card, opacity: chartType === 'income' ? 1 : 0.5 }]} onPress={() => toggleChartType('income')} activeOpacity={0.8}>
                    <View style={[styles.iconBox, { backgroundColor: INCOME_COLOR + '25' }]}><Ionicons name="arrow-up" size={18} color={INCOME_COLOR} /></View>
                    <View><Text style={[styles.cardLabel, { color: theme.muted }]}>Income</Text><Text style={[styles.cardValue, { color: theme.text }]}>₹{formatSmartNumber(processedData.stats.income)}</Text></View>
                  </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.statCard, { backgroundColor: theme.card, opacity: chartType === 'expense' ? 1 : 0.5 }]} onPress={() => toggleChartType('expense')} activeOpacity={0.8}>
                <View style={[styles.iconBox, { backgroundColor: EXPENSE_COLOR + '25' }]}><Ionicons name="arrow-down" size={18} color={EXPENSE_COLOR} /></View>
                <View><Text style={[styles.cardLabel, { color: theme.muted }]}>Expenses</Text><Text style={[styles.cardValue, { color: theme.text }]}>₹{formatSmartNumber(processedData.stats.expense)}</Text></View>
              </TouchableOpacity>
            </View>

            {insightPref !== "Minimal" && (
              <Animated.View entering={shouldAnimate ? FadeInDown.duration(600) : undefined}>
                <View style={{ marginTop: 32, height: 160, justifyContent: 'flex-end' }}>
                    {showDottedLine && (
                        <View style={[styles.dottedLine, { bottom: averageHeight + 20, borderColor: EXPENSE_COLOR }]}>
                            <Text style={{ color: EXPENSE_COLOR, fontSize: 10, position: 'absolute', right: 0, top: -14 }}>Avg</Text>
                        </View>
                    )}
                    <ScrollView ref={chartScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, alignItems: 'flex-end', height: 160 }}>
                        {processedData.chartData.map((d, i) => {
                            const isActive = selectedBarId !== null ? selectedBarId === d.id : true;
                            const barColor = theme.text; 
                            return (<SpringBar key={i} value={d.value} label={d.label} maxVal={maxChartVal} isActive={isActive} color={barColor} width={getBarWidth()} theme={theme} onPress={() => handleBarPress(d.id)} shouldAnimate={shouldAnimate} />)
                        })}
                    </ScrollView>
                </View>
                <CategoryStrip categories={processedData.categories} selectedCategory={selectedCategory} onSelect={handleCategoryPress} theme={theme} />
              </Animated.View>
            )}

            {/* 📊 DETAILED INSIGHTS SECTION */}
            {insightPref === "Detailed" && monthComparison && (
              <DetailedInsightsCard 
                monthComparison={monthComparison}
                biggestExpense={biggestExpense}
                bestSavingDay={bestSavingDay}
                theme={theme}
              />
            )}

            {/* 🤖 AI INSIGHTS SECTION */}
            {insightPref === "AI" && monthComparison && (
              <>
                <DetailedInsightsCard 
                  monthComparison={monthComparison}
                  biggestExpense={biggestExpense}
                  bestSavingDay={bestSavingDay}
                  theme={theme}
                />
                <AIInsightsCard 
                  burnRate={burnRate}
                  categoryAlerts={categoryAlerts}
                  theme={theme}
                />
              </>
            )}

            {insightPref === "AI" && (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <Animated.View entering={shouldAnimate ? FadeInDown.delay(200) : undefined} layout={Layout.springify()} style={[styles.aiCard, { borderColor: theme.accent, backgroundColor: theme.card }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isChatCollapsed ? 0 : 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{backgroundColor: theme.accent + '20', padding: 6, borderRadius: 8, marginRight: 8}}><MaterialCommunityIcons name="robot-outline" size={20} color={theme.accent} /></View>
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>Axiom 🤖</Text>
                  </View>
                  {messages.length > 0 && (<TouchableOpacity onPress={() => setIsChatCollapsed(!isChatCollapsed)} style={{ padding: 4 }}><Ionicons name={isChatCollapsed ? "chevron-down" : "chevron-up"} size={20} color={theme.muted} /></TouchableOpacity>)}
                </View>
                {messages.length === 0 && (
                    <View style={{ alignItems: 'flex-start' }}>
                        <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>I am Axiom, your personal AI financial strategist. I analyze your spending habits to find smart ways to save money.</Text>
                        <TouchableOpacity onPress={() => sendChatMessage(true)} disabled={aiLoading} style={{ backgroundColor: theme.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start' }}>
                            {aiLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Analyze Now</Text>}
                        </TouchableOpacity>
                    </View>
                )}
                {!isChatCollapsed && messages.length > 0 && (
                    <>
                        <View style={{ marginBottom: 16, gap: 10 }}>
                            {messages.map((msg, idx) => (
                                <Animated.View key={idx} entering={FadeInDown.duration(300)} style={[styles.chatBubble, msg.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: theme.border } : { alignSelf: 'flex-start', backgroundColor: theme.cardLight || theme.bg }]}>
                                    <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>{msg.content}</Text>
                                </Animated.View>
                            ))}
                            {aiLoading && (<View style={{ alignSelf: 'flex-start', padding: 8 }}><ActivityIndicator color={theme.muted} size="small" /></View>)}
                        </View>
                        <View style={[styles.inputRow, { borderColor: theme.border }]}>
                            <TextInput ref={inputRef} placeholder="Ask Axiom..." placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text }]} value={inputText} onChangeText={setInputText} onSubmitEditing={() => sendChatMessage(false)} maxLength={100} />
                            <Text style={{ fontSize: 10, color: theme.muted, marginRight: 8 }}>{inputText.length}/100</Text>
                            <TouchableOpacity onPress={() => sendChatMessage(false)} disabled={aiLoading || !inputText.trim()}><Ionicons name="arrow-up-circle" size={32} color={!inputText.trim() ? theme.muted : theme.accent} /></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ marginTop: 10, gap: 8 }}>
                            <TouchableOpacity onPress={() => sendChatMessage(true)} style={{ backgroundColor: theme.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: theme.accent }}>
                                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>✨ Analyze My Finances</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </>
                )}
                {isChatCollapsed && messages.length > 0 && (
                    <TouchableOpacity onPress={handleContinueChat} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.accent} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 14 }}>Continue Chatting...</Text>
                    </TouchableOpacity>
                )}
              </Animated.View>
              </KeyboardAvoidingView>
            )}

            <View style={{ marginTop: 20 }}>
              {groupedTransactions.length === 0 ? (
                  <Text style={{color: theme.muted, textAlign: 'center', marginTop: 20}}>{chartType === null ? "Select Income or Expense to see details." : "No transactions for this selection."}</Text>
              ) : groupedTransactions.map(([dateLabel, txs]: any) => (
                <View key={dateLabel} style={{ marginBottom: 24 }}>
                  <Text style={[styles.sectionHeader, { color: theme.muted }]}>{dateLabel}</Text>
                  {txs.map((t: any) => {
                    const rawTitle = t.note && t.note.trim() !== "" ? t.note : (t.category?.label || "Transaction");
                    const displayTitle = rawTitle.length > 10 ? rawTitle.substring(0, 10) + "..." : rawTitle;
                    return (
                        <View key={t.id} style={styles.txRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                                <View style={[styles.txIcon, { backgroundColor: t.category?.color ? t.category.color + '20' : theme.border }]}><Text style={{ fontSize: 20 }}>{t.category?.emoji || '💸'}</Text></View>
                                <View style={{ marginLeft: 14, flex: 1 }}>
                                    <Text style={[styles.txTitle, { color: theme.text }]} numberOfLines={1}>{displayTitle}</Text>
                                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 2}}>
                                        <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>{t.category?.label || "General"}</Text>
                                        <Text style={{ color: theme.muted, fontSize: 12 }}>{' • ' + new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </View>
                                </View>
                            </View>
                            <Text style={[styles.txAmount, { color: t.type === 'income' ? INCOME_COLOR : theme.text }]}>{t.type === 'expense' ? '-' : '+'}₹{formatSmartNumber(Number(t.amount))}</Text>
                        </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, zIndex: 10 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  rangeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  rangeText: { fontWeight: '600', fontSize: 14, textTransform: 'capitalize' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  dropdownMenu: { position: 'absolute', borderRadius: 12, padding: 4, width: 120, shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  dropdownText: { fontWeight: '600', textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  bigAmount: { fontSize: 34, fontWeight: '800' },
  subAmount: { fontSize: 26, fontWeight: '700', marginTop: 4 },
  cardRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  statCard: { flex: 1, padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  cardValue: { fontSize: 18, fontWeight: '700' },
  barWrapper: { alignItems: 'center', height: '100%', justifyContent: 'flex-end', paddingHorizontal: 2 },
  barTrack: { width: '100%', height: 120, justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: 12, borderRadius: 6, minHeight: 6 },
  barLabel: { fontSize: 10, fontWeight: '600', marginTop: 6 },
  aiCard: { marginTop: 24, padding: 16, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  chatBubble: { padding: 10, borderRadius: 12, maxWidth: '85%', marginBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, borderWidth: 1, borderRadius: 25, paddingHorizontal: 4, paddingVertical: 4 },
  input: { flex: 1, paddingHorizontal: 12, fontSize: 14, height: 40 },
  sectionHeader: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  txIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 17, fontWeight: '600' },
  txTime: { fontSize: 13, marginTop: 2 },
  txAmount: { fontSize: 17, fontWeight: '700' },
  dottedLine: { position: 'absolute', left: 0, right: 0, borderWidth: 1, borderRadius: 1, borderStyle: 'dashed', opacity: 0.5, zIndex: 0 },
  insightCard: { marginTop: 20, padding: 16, borderRadius: 18, marginBottom: 20 },
  insightTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
});