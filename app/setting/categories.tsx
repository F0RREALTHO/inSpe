import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router"; // ✅ Added useLocalSearchParams
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
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

/* --- TYPES --- */
type Category = {
  id: string;
  emoji: string;
  label: string;
  color: string;
  isCustom: boolean; 
};

/* --- COLORS --- */
const COLORS = [
  "#3b82f6", "#8b5cf6", "#d946ef", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#6366f1", "#64748b", "#78716c", "#a8a29e", "#d6d3d1"
];

/* --- DEFAULTS --- */
const ALL_SYSTEM_EXPENSES: Category[] = [
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

const INCOME_SUGGESTED: Category[] = [
  { id: '101', emoji: '💰', label: 'Paycheck', color: '#22c55e', isCustom: false },
  { id: '102', emoji: '🤑', label: 'Allowance', color: '#f59e0b', isCustom: false },
  { id: '103', emoji: '💼', label: 'Part-Time', color: '#8b5cf6', isCustom: false },
  { id: '104', emoji: '📈', label: 'Investments', color: '#10b981', isCustom: false },
  { id: '105', emoji: '🧧', label: 'Gifts', color: '#f43f5e', isCustom: false },
  { id: '106', emoji: '🪙', label: 'Tips', color: '#a8a29e', isCustom: false },
];

const EMOJI_REGEX = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

export default function CategoriesScreen() {
  const router = useRouter();
  const { theme, dark } = useTheme();
  const { initialTab } = useLocalSearchParams(); // ✅ Get param
  const [loading, setLoading] = useState(true);

  // --- STATE ---
  // ✅ Initialize based on param (expense or income)
  const [tab, setTab] = useState<'expense' | 'income'>((initialTab as 'expense' | 'income') || 'expense');
  
  const [exActive, setExActive] = useState<Category[]>([]);
  const [exSugg, setExSugg] = useState<Category[]>(ALL_SYSTEM_EXPENSES); 
  const [inActive, setInActive] = useState<Category[]>([]);
  const [inSugg, setInSugg] = useState<Category[]>(INCOME_SUGGESTED);

  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const [bannerVisible, setBannerVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [tempName, setTempName] = useState("");
  const [tempEmoji, setTempEmoji] = useState("📁");
  const [tempColor, setTempColor] = useState(COLORS[0]);
  const [targetType, setTargetType] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);

        if (snap.exists() && mounted) {
          const data = snap.data();
          
          // 1. Load Active Expense Categories
          const savedEx = data.categories || [];
          const exOnboarded: Category[] = savedEx.map((item: any, index: number) => {
            if (typeof item === 'string') {
              const sysMatch = ALL_SYSTEM_EXPENSES.find(s => s.label === item);
              return sysMatch || { id: `legacy-${index}`, label: item, emoji: '📁', color: '#888', isCustom: true };
            }
            return item;
          });

          // 2. Load Active Income Categories
          const savedIn = data.incomeCategories || [];
          const inOnboarded: Category[] = savedIn.map((item: any, index: number) => {
             if (typeof item === 'string') {
                 const sysMatch = INCOME_SUGGESTED.find(s => s.label === item);
                 return sysMatch || { id: `legacy-in-${index}`, label: item, emoji: '💰', color: '#888', isCustom: true };
             }
             return item;
          });

          // 3. Filter Suggestions
          const activeExIds = new Set(exOnboarded.map(c => c.id));
          const remainingExSugg = ALL_SYSTEM_EXPENSES.filter(c => !activeExIds.has(c.id));

          const activeInIds = new Set(inOnboarded.map(c => c.id));
          const remainingInSugg = INCOME_SUGGESTED.filter(c => !activeInIds.has(c.id));

          setExActive(exOnboarded);
          setExSugg(remainingExSugg);
          
          setInActive(inOnboarded);
          setInSugg(remainingInSugg);
        }
      } catch (error) {
        console.log("Error loading categories:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadCategories();
    return () => { mounted = false; };
  }, []);

  const saveToFirestore = async (newExActive: Category[], newInActive: Category[]) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid), {
        categories: newExActive,
        incomeCategories: newInActive 
      });
    } catch (e) {
      console.error("Sync error", e);
    }
  };

  // --- HELPERS ---
  const activeList = tab === 'expense' ? exActive : inActive;
  const suggestedList = tab === 'expense' ? exSugg : inSugg;

  const addSuggested = (item: Category) => {
    if (tab === 'expense') {
      const newExActive = [...exActive, item];
      const newExSugg = exSugg.filter(i => i.id !== item.id);
      
      setExActive(newExActive);
      setExSugg(newExSugg);
      saveToFirestore(newExActive, inActive);
    } else {
      const newInActive = [...inActive, item];
      const newInSugg = inSugg.filter(i => i.id !== item.id);
      
      setInActive(newInActive);
      setInSugg(newInSugg);
      saveToFirestore(exActive, newInActive);
    }
  };

  const handleEmojiChange = (text: string) => {
    if (text === "") { setTempEmoji(""); return; }
    const match = text.match(EMOJI_REGEX);
    if (match) setTempEmoji(match[match.length - 1]);
  };

  const toggleSuggestions = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (suggestionsVisible) {
        setSuggestionsVisible(false);
        setBannerVisible(true);
        setTimeout(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setBannerVisible(false);
        }, 5000);
    } else {
        setSuggestionsVisible(true);
        setBannerVisible(false);
    }
  };

  // --- ACTIONS ---
  const handleOpenNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setTargetType(tab); 
    setTempName("");
    setTempEmoji("✨");
    setTempColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    setModalVisible(true);
  };

  const handleOpenEdit = (item: Category) => {
    setIsCreating(false);
    setEditingId(item.id);
    setTargetType(tab); 
    setTempName(item.label);
    setTempEmoji(item.emoji);
    setTempColor(item.color);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!tempName.trim()) return;

    const newItem: Category = {
      id: isCreating ? Date.now().toString() : editingId!,
      emoji: tempEmoji || "📁", 
      label: tempName,
      color: tempColor,
      isCustom: isCreating ? true : (activeList.find(i => i.id === editingId)?.isCustom ?? false)
    };

    let newEx = [...exActive];
    let newIn = [...inActive];

    if (targetType === 'expense') {
      if (isCreating) newEx.push(newItem);
      else newEx = newEx.map(i => i.id === newItem.id ? newItem : i);
      setExActive(newEx);
    } else {
      if (isCreating) newIn.push(newItem);
      else newIn = newIn.map(i => i.id === newItem.id ? newItem : i);
      setInActive(newIn);
    }
    
    if(isCreating && targetType !== tab) setTab(targetType);
    setModalVisible(false);
    
    saveToFirestore(newEx, newIn);
  };

  const handleDelete = () => {
    const itemToDelete = activeList.find(i => i.id === editingId);
    if (!itemToDelete) return;

    const performDelete = () => {
      let newEx = [...exActive];
      let newIn = [...inActive];

      if (tab === 'expense') {
        newEx = newEx.filter(i => i.id !== editingId);
        setExActive(newEx);
        if (!itemToDelete.isCustom) setExSugg(prev => [itemToDelete, ...prev]);
      } else {
        newIn = newIn.filter(i => i.id !== editingId);
        setInActive(newIn);
        if (!itemToDelete.isCustom) setInSugg(prev => [itemToDelete, ...prev]);
      }
      
      setModalVisible(false);
      saveToFirestore(newEx, newIn);
    };

    Alert.alert(
      `Delete '${itemToDelete.label}'?`,
      `This action cannot be undone.`,
      [
        { text: "Delete", style: "destructive", onPress: performDelete },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  if (loading) {
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={theme.accent} />
        </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      
      <View style={styles.header}>
        <TouchableOpacity 
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={() => router.back()} 
            style={[styles.roundBtn, { backgroundColor: theme.card }]}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Categories</Text>
        <TouchableOpacity onPress={toggleSuggestions} style={[styles.roundBtn, { backgroundColor: theme.card }]}>
          <Ionicons name={suggestionsVisible ? "eye-off-outline" : "eye-outline"} size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        {!suggestionsVisible && bannerVisible && (
            <View style={styles.hiddenBanner}>
                <Ionicons name="eye-off-outline" size={16} color="#065f46" style={{ marginRight: 6 }} />
                <Text style={styles.hiddenBannerText}>Suggestions Hidden</Text>
            </View>
        )}

        <Text style={styles.sectionLabel}>{tab.toUpperCase()} CATEGORIES</Text>
        
        {activeList.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Ionicons name="file-tray-outline" size={40} color={theme.muted} style={{ opacity: 0.5, marginBottom: 10 }} />
            <Text style={{ color: theme.muted, textAlign: 'center', lineHeight: 20 }}>
              No {tab === 'expense' ? 'expense' : 'income'} categories found, click the{'\n'}'New' button to add some
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {activeList.map((item) => (
              <Pressable 
                key={item.id} 
                style={({ pressed }) => [
                  styles.row, 
                  { borderBottomWidth: 1, borderBottomColor: theme.bg },
                  pressed && { backgroundColor: theme.cardLight }
                ]}
                onPress={() => handleOpenEdit(item)}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.emoji}>{item.emoji}</Text>
                  <Text style={[styles.rowText, { color: theme.text }]}>{item.label}</Text>
                </View>
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              </Pressable>
            ))}
          </View>
        )}

        {suggestionsVisible && (
            <>
                <Text style={[styles.sectionLabel, { marginTop: 30 }]}>SUGGESTED</Text>
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                {suggestedList.length > 0 ? (
                    suggestedList.map((item) => (
                        <Pressable 
                        key={item.id}
                        style={({ pressed }) => [
                            styles.row, 
                            { borderBottomWidth: 1, borderBottomColor: theme.bg },
                            pressed && { backgroundColor: theme.cardLight }
                        ]}
                        onPress={() => addSuggested(item)}
                        >
                        <View style={styles.rowLeft}>
                            <Text style={styles.emoji}>{item.emoji}</Text>
                            <Text style={[styles.rowText, { color: theme.text }]}>{item.label}</Text>
                        </View>
                        <View style={[styles.addBtn, { backgroundColor: theme.bg }]}>
                            <Ionicons name="add" size={18} color={theme.muted} />
                        </View>
                        </Pressable>
                    ))
                ) : (
                    <Text style={{ padding: 20, textAlign: 'center', color: theme.muted }}>All suggestions added!</Text>
                )}
                </View>
            </>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={[styles.togglePill, { backgroundColor: dark ? '#1e1e1e' : '#e5e7eb' }]}>
          <TouchableOpacity 
            style={[styles.toggleBtn, tab === 'expense' && { backgroundColor: theme.card }]}
            onPress={() => setTab('expense')}
          >
            <Text style={[styles.toggleText, { color: tab === 'expense' ? theme.text : theme.muted }]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, tab === 'income' && { backgroundColor: theme.card }]}
            onPress={() => setTab('income')}
          >
            <Text style={[styles.toggleText, { color: tab === 'income' ? theme.text : theme.muted }]}>Income</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.newBtn, { backgroundColor: theme.card }]} onPress={handleOpenNew}>
          <Ionicons name="add" size={20} color={theme.text} />
          <Text style={{ fontWeight: 'bold', color: theme.text, marginLeft: 4 }}>New</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: '#121212' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.roundBtnDark}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
            
            {isCreating ? (
                <View style={[styles.miniTogglePill, { backgroundColor: '#333' }]}>
                    <TouchableOpacity 
                        style={[styles.miniToggleBtn, targetType === 'expense' && { backgroundColor: '#555' }]}
                        onPress={() => setTargetType('expense')}
                    >
                        <Text style={{color: '#fff', fontSize: 13, fontWeight: '700'}}>Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.miniToggleBtn, targetType === 'income' && { backgroundColor: '#555' }]}
                        onPress={() => setTargetType('income')}
                    >
                        <Text style={{color: '#fff', fontSize: 13, fontWeight: '700'}}>Income</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <Text style={styles.modalTitle}>Edit {tab === 'expense' ? 'Expense' : 'Income'}</Text>
            )}
            
            <TouchableOpacity 
                onPress={handleDelete} 
                style={[styles.roundBtnDark, { backgroundColor: isCreating ? 'transparent' : '#ef444433' }]}
                disabled={isCreating}
            >
              {!isCreating && <Ionicons name="trash" size={20} color="#ef4444" />}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
            <View style={[styles.previewIcon, { backgroundColor: '#1e1e1e' }]}>
                <Text style={{fontSize: 50}}>{tempEmoji}</Text>
            </View>

            <View style={styles.colorGrid}>
              {COLORS.map(c => (
                <TouchableOpacity 
                  key={c} 
                  style={[styles.colorCell, { backgroundColor: c }, tempColor === c && styles.colorCellActive]}
                  onPress={() => setTempColor(c)}
                >
                  {tempColor === c && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.miniColorBox, { backgroundColor: tempColor }]} />
              <TextInput 
                style={styles.input}
                value={tempName}
                onChangeText={setTempName}
                placeholder="Category Name"
                placeholderTextColor="#666"
                autoFocus={isCreating}
              />
              <TouchableOpacity style={styles.checkBtn} onPress={handleSave}>
                <Ionicons name="checkmark" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.emojiInputRow}>
                <TextInput 
                    style={styles.emojiInput}
                    value={tempEmoji}
                    onChangeText={handleEmojiChange}
                    maxLength={2} 
                />
                <Text style={{color: '#666', fontSize: 12}}>Edit Emoji</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 10, marginLeft: 6 },
  
  card: { borderRadius: 16, overflow: 'hidden' },
  emptyCard: { borderRadius: 16, padding: 30, alignItems: 'center', justifyContent: 'center', minHeight: 120 },

  hiddenBanner: { 
    backgroundColor: '#10b98133', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#10b981'
  },
  hiddenBannerText: { color: '#065f46', fontWeight: '700', fontSize: 13 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 22 },
  rowText: { fontSize: 16, fontWeight: '600' },
  colorDot: { width: 14, height: 14, borderRadius: 4 },
  addBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  bottomBar: { position: 'absolute', bottom: 30, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  togglePill: { flexDirection: 'row', padding: 4, borderRadius: 25, height: 50, alignItems: 'center' },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  toggleText: { fontWeight: '700', fontSize: 14 },
  newBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 50, borderRadius: 25 },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  roundBtnDark: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  previewIcon: { width: 100, height: 100, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#333' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 30, width: '100%' },
  colorCell: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  colorCellActive: { borderWidth: 3, borderColor: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', borderRadius: 16, padding: 8, width: '100%' },
  miniColorBox: { width: 40, height: 40, borderRadius: 10, marginRight: 12 },
  input: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600', height: '100%' },
  checkBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  emojiInputRow: { marginTop: 20, alignItems: 'center', gap: 5 },
  emojiInput: { backgroundColor: '#1e1e1e', color: '#fff', fontSize: 24, textAlign: 'center', width: 60, height: 60, borderRadius: 12 },
  
  miniTogglePill: { flexDirection: 'row', borderRadius: 20, padding: 2 },
  miniToggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18 },
});