import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { arrayRemove, arrayUnion, collection, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { useData } from '../context/DataProvider';
import { useTheme } from '../context/ThemeContext';

const GOLD_COLOR = "#FFD700";
const GOLD_BG = "#FFD70020";

type SavingsGoal = {
    id: string;
    name: string;
    target: number;
    current: number;
    emoji: string;
    isLocked?: boolean;
};

const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    });
};

const HoldToDeleteButton = ({ onDelete }: { onDelete: () => void }) => {
    const [isHolding, setIsHolding] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;
    const { theme } = useTheme();

    const handlePressIn = () => {
        setIsHolding(true);
        Haptics.selectionAsync();
        Animated.timing(progress, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false
        }).start(({ finished }) => {
            if (finished) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onDelete();
            }
        });
    };

    const handlePressOut = () => {
        setIsHolding(false);
        Animated.timing(progress, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false
        }).start();
    };

    const widthInterpolate = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%']
    });

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={{ width: '100%', alignItems: 'center' }}
        >
            <View style={{
                height: 50,
                width: 160,
                backgroundColor: theme.bg,
                borderRadius: 25,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: isHolding ? '#ef4444' : theme.border
            }}>
                <Animated.View style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: widthInterpolate, backgroundColor: '#ef4444'
                }} />

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="trash-outline" size={18} color={isHolding ? "#fff" : "#ef4444"} style={{ marginRight: 6 }} />
                    <Text style={{ color: isHolding ? "#fff" : theme.text, fontWeight: '700', fontSize: 13 }}>
                        {isHolding ? "HOLD TO DELETE" : "DELETE GOAL"}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
};

export default function SavingsWidget() {
    const { theme } = useTheme();
    const { userData, transactions, refreshData } = useData();

    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [seeAllVisible, setSeeAllVisible] = useState(false);

    const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
    const [amount, setAmount] = useState('');
    const [newGoalName, setNewGoalName] = useState('');
    const [newGoalTarget, setNewGoalTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'add' | 'withdraw'>('add');

    const allGoals: SavingsGoal[] = userData?.savingsGoals || [];

    const activeGoals = allGoals.filter(g => !g.isLocked && (g.target === 0 || g.current < g.target));
    const completedGoals = allGoals.filter(g => g.isLocked || (g.target > 0 && g.current >= g.target));

    const safeToSpend = useMemo(() => {
        const monthlyLimit = parseFloat(userData?.monthlyLimit || '0');
        const now = new Date();
        let totalInc = 0; let totalExp = 0; let currentMonthExp = 0;

        transactions.forEach((t: any) => {
            const isExpense = t.type === 'expense';
            if (isExpense) totalExp += t.amount; else totalInc += t.amount;

            const tDate = new Date(t.date);
            if (isExpense && tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) {
                currentMonthExp += t.amount;
            }
        });

        const balance = totalInc - totalExp;
        const budgetRemaining = monthlyLimit - currentMonthExp;
        return Math.min(budgetRemaining, balance);
    }, [transactions, userData]);

    useEffect(() => {
        const migrateOnboardingGoal = async () => {
            if (allGoals.length === 0 && userData?.savingGoal) {
                const initialGoal: SavingsGoal = {
                    id: Crypto.randomUUID(),
                    name: userData.savingGoal,
                    target: parseFloat(userData.savingGoalTarget || '0'),
                    current: parseFloat(userData.savingGoalCurrent || '0'),
                    emoji: '🎯',
                    isLocked: false
                };
                const userRef = doc(db, 'users', auth.currentUser!.uid);
                await updateDoc(userRef, { savingsGoals: [initialGoal] });
                refreshData();
            }
        };
        if (userData && auth.currentUser) migrateOnboardingGoal();
    }, [userData]);

    const getPredictedBalance = () => {
        if (!selectedGoal) return 0;
        const val = parseFloat(amount) || 0;
        if (mode === 'add') return selectedGoal.current + val;
        return Math.max(0, selectedGoal.current - val);
    };

    const performTransaction = async (val: number) => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId || !selectedGoal) return;

            const batch = writeBatch(db);
            const userRef = doc(db, 'users', userId);
            const newTxRef = doc(collection(db, 'users', userId, 'transactions'));
            const isDeposit = mode === 'add';

            batch.set(newTxRef, {
                amount: val,
                type: isDeposit ? 'expense' : 'income',
                category: { label: 'Savings', emoji: selectedGoal.emoji || '🐷', color: GOLD_COLOR },
                note: isDeposit ? `Added to ${selectedGoal.name}` : `Withdrew from ${selectedGoal.name}`,
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                isSavings: true
            });

            const updatedGoal = {
                ...selectedGoal,
                current: isDeposit ? selectedGoal.current + val : Math.max(0, selectedGoal.current - val)
            };

            batch.update(userRef, { savingsGoals: arrayRemove(selectedGoal) });
            batch.update(userRef, { savingsGoals: arrayUnion(updatedGoal) });

            await batch.commit();
            await refreshData();

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setActionModalVisible(false);
            setAmount('');
        } catch (e) {
            Alert.alert("Error", "Transaction failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleMoneyAction = async () => {
        if (!amount || !selectedGoal) return;
        setLoading(true);

        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) { setLoading(false); return; }

        if (mode === 'withdraw' && val > selectedGoal.current) {
            setLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Insufficient Funds", `You only have ${formatCurrency(selectedGoal.current)} available.`);
            return;
        }

        if (mode === 'add') {
            if (safeToSpend > 0 && val > safeToSpend) {
                setLoading(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(
                    "Budget Exceeded",
                    `You only have ${formatCurrency(safeToSpend)} Safe-to-Spend available.\n\nAdding this will make your budget negative.`
                );
                return;
            }

            const potentialTotal = selectedGoal.current + val;
            if (selectedGoal.target > 0 && potentialTotal > selectedGoal.target) {
                const excess = potentialTotal - selectedGoal.target;
                Alert.alert("Exceeding Target", `This deposit is ${formatCurrency(excess)} more than needed.\n\nContinue?`, [
                    { text: "Cancel", style: "cancel", onPress: () => setLoading(false) },
                    { text: "Yes, Deposit", onPress: () => performTransaction(val) }
                ]);
                return;
            }
        }
        performTransaction(val);
    };

    const handleCreateGoal = async () => {
        if (!newGoalName) return;
        setLoading(true);
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            const newGoal: SavingsGoal = {
                id: Crypto.randomUUID(),
                name: newGoalName.toUpperCase(),
                target: parseFloat(newGoalTarget) || 0,
                current: 0,
                emoji: '🎯',
                isLocked: false
            };
            await updateDoc(doc(db, 'users', userId), { savingsGoals: arrayUnion(newGoal) });
            await refreshData();
            setCreateModalVisible(false);
            setNewGoalName('');
            setNewGoalTarget('');
        } catch (e) {
            Alert.alert("Error", "Could not create goal.");
        } finally {
            setLoading(false);
        }
    };

    const deleteGoal = async () => {
        if (!selectedGoal) return;
        try {
            const userRef = doc(db, 'users', auth.currentUser!.uid);
            await updateDoc(userRef, { savingsGoals: arrayRemove(selectedGoal) });
            await refreshData();
            setActionModalVisible(false);
        } catch (e) {
            Alert.alert("Error", "Could not delete goal.");
        }
    };

    const handleLockGoal = async () => {
        if (!selectedGoal) return;

        Alert.alert(
            "How did you pay?",
            `To keep your budget accurate:\n\n💳 CARD/UPI: Choose this if you expect an SMS/Bank transaction. We will unlock the funds to offset it.\n\n💵 CASH: Choose this if no digital record exists. We will unlock funds AND record the expense immediately.`,
            [
                { text: "Cancel", style: "cancel" },

                {
                    text: "💵 Cash / No SMS",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const userId = auth.currentUser?.uid;
                            if (!userId) return;

                            const batch = writeBatch(db);
                            const userRef = doc(db, 'users', userId);
                            const timestamp = new Date().toISOString();

                            const unlockRef = doc(collection(db, 'users', userId, 'transactions'));
                            batch.set(unlockRef, {
                                amount: selectedGoal.current,
                                type: 'income',
                                category: { label: 'Savings Unlocked', emoji: '🔓', color: '#22c55e' },
                                note: `Unlocked for: ${selectedGoal.name}`,
                                date: timestamp,
                                createdAt: timestamp,
                                isSavings: true
                            });

                            const expenseRef = doc(collection(db, 'users', userId, 'transactions'));
                            batch.set(expenseRef, {
                                amount: selectedGoal.current,
                                type: 'expense',
                                category: {
                                    label: 'Goal Purchased',
                                    emoji: selectedGoal.emoji,
                                    color: GOLD_COLOR
                                },
                                note: `Purchased: ${selectedGoal.name} (Cash)`,
                                date: timestamp,
                                createdAt: timestamp,
                                isSavings: false // Shows in Insights
                            });

                            const updatedGoal = { ...selectedGoal, isLocked: true };
                            batch.update(userRef, { savingsGoals: arrayRemove(selectedGoal) });
                            batch.update(userRef, { savingsGoals: arrayUnion(updatedGoal) });

                            await batch.commit();
                            await refreshData();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setActionModalVisible(false);
                        } catch (e) {
                            Alert.alert("Error", "Could not process cash purchase.");
                        } finally {
                            setLoading(false);
                        }
                    }
                },

                {
                    text: "💳 Card / UPI",
                    style: 'default',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const userId = auth.currentUser?.uid;
                            if (!userId) return;

                            const batch = writeBatch(db);
                            const userRef = doc(db, 'users', userId);

                            const newTxRef = doc(collection(db, 'users', userId, 'transactions'));
                            batch.set(newTxRef, {
                                amount: selectedGoal.current,
                                type: 'income',
                                category: { label: 'Savings Unlocked', emoji: '🔓', color: '#22c55e' },
                                note: `Goal Purchased (Offset): ${selectedGoal.name}`,
                                date: new Date().toISOString(),
                                createdAt: new Date().toISOString(),
                                isSavings: true
                            });

                            const updatedGoal = { ...selectedGoal, isLocked: true };
                            batch.update(userRef, { savingsGoals: arrayRemove(selectedGoal) });
                            batch.update(userRef, { savingsGoals: arrayUnion(updatedGoal) });

                            await batch.commit();
                            await refreshData();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setActionModalVisible(false);
                        } catch (e) {
                            Alert.alert("Error", "Could not lock goal.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const openGoal = (goal: SavingsGoal, fromSeeAll = false) => {
        if (fromSeeAll) {
            setSeeAllVisible(false);
            setTimeout(() => {
                setSelectedGoal(goal);
                setMode('add');
                setActionModalVisible(true);
            }, 300);
        } else {
            setSelectedGoal(goal);
            setMode('add');
            setActionModalVisible(true);
        }
    };

    const GoalCard = ({ goal, fromSeeAll = false }: { goal: SavingsGoal, fromSeeAll?: boolean }) => {
        const hasTarget = goal.target > 0;
        const progress = hasTarget ? Math.min(goal.current / goal.target, 1) : 0;
        const percent = hasTarget ? Math.round(progress * 100) : 0;
        const isCompleted = hasTarget && goal.current >= goal.target;
        const isLocked = goal.isLocked;

        return (
            <TouchableOpacity
                style={[
                    styles.goalCard,
                    {
                        backgroundColor: theme.card,
                        borderColor: isLocked ? theme.border : (isCompleted ? '#22c55e' : 'transparent'),
                        borderWidth: 1,
                        width: '100%',
                        opacity: isLocked ? 0.8 : 1
                    }
                ]}
                onPress={() => openGoal(goal, fromSeeAll)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: isLocked ? theme.border : (isCompleted ? '#22c55e20' : GOLD_BG) }]}>
                        {isLocked ? (
                            <Ionicons name="lock-closed" size={16} color={theme.muted} />
                        ) : isCompleted ? (
                            <Ionicons name="checkmark" size={18} color="#22c55e" />
                        ) : (
                            <Text style={{ fontSize: 16 }}>{goal.emoji}</Text>
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: theme.muted }]}>{goal.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
                                {formatCurrency(goal.current)}
                            </Text>
                            {hasTarget ? (
                                <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '600' }}>
                                    of {formatCurrency(goal.target)}
                                </Text>
                            ) : (
                                <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '600' }}>
                                    saved till date
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        {isLocked ? (
                            <Text style={{ fontSize: 10, fontWeight: '800', color: theme.muted, textTransform: 'uppercase' }}>PURCHASED</Text>
                        ) : hasTarget ? (
                            <Text style={{ fontSize: 14, fontWeight: '800', color: isCompleted ? '#22c55e' : theme.text }}>{percent}%</Text>
                        ) : null}
                    </View>
                </View>

                {hasTarget && !isLocked && (
                    <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: isCompleted ? '#22c55e' : GOLD_COLOR }]} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ marginTop: 30, zIndex: 10, elevation: 10, position: 'relative' }}>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>Saving Goals</Text>
                {(activeGoals.length > 0 || completedGoals.length > 0) && (
                    <TouchableOpacity onPress={() => setSeeAllVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '700' }}>See All</Text>
                    </TouchableOpacity>
                )}
            </View>

            {safeToSpend < 0 && activeGoals.some(g => g.current > 0) && (
                <View style={{ backgroundColor: '#ef444415', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#ef444450', flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="warning" size={20} color="#ef4444" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Negative Balance?</Text>
                        <Text style={{ color: theme.muted, fontSize: 11 }}>
                            If you bought something from your savings, tap a goal and "Mark as Purchased" to fix it.
                        </Text>
                    </View>
                </View>
            )}

            <View style={{ gap: 12 }}>
                {activeGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                ))}

                <TouchableOpacity
                    style={[styles.addCardVertical, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => setCreateModalVisible(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="add" size={24} color={theme.muted} />
                    <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '700', marginLeft: 8 }}>ADD NEW GOAL</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={seeAllVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSeeAllVisible(false)}
            >
                <View style={[styles.fullScreenModal, { backgroundColor: theme.bg }]}>
                    <View style={styles.modalHeaderRow}>
                        <Text style={[styles.bigTitle, { color: theme.text }]}>All Savings</Text>
                        <TouchableOpacity onPress={() => setSeeAllVisible(false)} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        {activeGoals.length > 0 && (
                            <View style={{ marginBottom: 24 }}>
                                <Text style={[styles.sectionHeader, { color: theme.muted, marginBottom: 10 }]}>IN PROGRESS</Text>
                                <View style={{ gap: 10 }}>{activeGoals.map(g => <GoalCard key={g.id} goal={g} fromSeeAll={true} />)}</View>
                            </View>
                        )}
                        {completedGoals.length > 0 && (
                            <View>
                                <Text style={[styles.sectionHeader, { color: theme.muted, marginBottom: 10 }]}>COMPLETED / PURCHASED 🎉</Text>
                                <View style={{ gap: 10 }}>{completedGoals.map(g => <GoalCard key={g.id} goal={g} fromSeeAll={true} />)}</View>
                            </View>
                        )}
                        {allGoals.length === 0 && <Text style={{ textAlign: 'center', color: theme.muted, marginTop: 50 }}>No savings goals yet.</Text>}
                    </ScrollView>
                </View>
            </Modal>

            <Modal
                visible={actionModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setActionModalVisible(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                    <View style={[styles.premiumModal, { backgroundColor: theme.card }]}>
                        <View style={styles.premiumHeader}>
                            <Text style={[styles.premiumTitle, { color: theme.text }]} numberOfLines={1}>{selectedGoal?.name}</Text>
                            {selectedGoal?.isLocked && <Ionicons name="lock-closed" size={20} color={theme.muted} style={{ marginLeft: 8 }} />}
                        </View>

                        {selectedGoal?.isLocked ? (
                            <View style={{ alignItems: 'center', marginVertical: 40 }}>
                                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#22c55e20', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                    <Ionicons name="cart" size={40} color="#22c55e" />
                                </View>
                                <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text, marginBottom: 8 }}>GOAL ACHIEVED</Text>
                                <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', paddingHorizontal: 20 }}>
                                    Funds processed. History locked.
                                </Text>
                            </View>
                        ) : (
                            <>
                                <View style={[styles.pillContainer, { backgroundColor: theme.bg }]}>
                                    <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setMode('add'); }} style={[styles.pill, mode === 'add' && { backgroundColor: GOLD_COLOR, shadowOpacity: 0.3 }]}>
                                        <Text style={[styles.pillText, { color: mode === 'add' ? '#000' : theme.muted }]}>Deposit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setMode('withdraw'); }} style={[styles.pill, mode === 'withdraw' && { backgroundColor: '#ef4444', shadowOpacity: 0.3 }]}>
                                        <Text style={[styles.pillText, { color: mode === 'withdraw' ? '#fff' : theme.muted }]}>Withdraw</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ alignItems: 'center', marginVertical: 30 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.muted, marginBottom: 10 }}>{mode === 'add' ? 'How much to save?' : 'How much to remove?'}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 36, fontWeight: '900', color: theme.text, marginRight: 4 }}>₹</Text>
                                        <TextInput style={[styles.hugeInput, { color: theme.text }]} placeholder="0" placeholderTextColor={theme.muted + '50'} keyboardType="numeric" autoFocus value={amount} onChangeText={setAmount} maxLength={8} />
                                    </View>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.accent, marginTop: 8, opacity: amount ? 1 : 0 }}>New Balance: {formatCurrency(getPredictedBalance())}</Text>
                                </View>
                                <View style={styles.modalActions}>
                                    <TouchableOpacity onPress={() => { setActionModalVisible(false); setAmount(''); }} style={[styles.cancelBtn, { borderColor: theme.border }]}>
                                        <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleMoneyAction} style={[styles.confirmBtn, { backgroundColor: mode === 'withdraw' ? '#ef4444' : GOLD_COLOR, shadowColor: mode === 'withdraw' ? '#ef4444' : GOLD_COLOR }]} disabled={loading}>
                                        {loading ? <ActivityIndicator color={mode === 'withdraw' ? '#fff' : '#000'} size="small" /> : <Text style={{ color: mode === 'withdraw' ? '#fff' : '#000', fontWeight: '800', fontSize: 16 }}>{mode === 'withdraw' ? 'WITHDRAW' : 'CONFIRM'}</Text>}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        {selectedGoal && !selectedGoal.isLocked && selectedGoal.current > 0 && (
                            <TouchableOpacity
                                onPress={handleLockGoal}
                                style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#22c55e', borderRadius: 16, width: '100%' }}
                            >
                                <Ionicons name="cart-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={{ color: '#fff', fontWeight: '800' }}>MARK AS PURCHASED</Text>
                            </TouchableOpacity>
                        )}

                        <View style={{ marginTop: 30, width: '100%', alignItems: 'center' }}>
                            {selectedGoal?.isLocked ? (
                                <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                                    <Text style={{ color: theme.muted, fontWeight: '600' }}>Close</Text>
                                </TouchableOpacity>
                            ) : (
                                <HoldToDeleteButton onDelete={deleteGoal} />
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal
                visible={createModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setCreateModalVisible(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                    <View style={[styles.premiumModal, { backgroundColor: theme.card }]}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.muted, letterSpacing: 1, marginBottom: 20 }}>NEW GOAL</Text>
                        <TextInput style={{ fontSize: 28, fontWeight: '900', color: theme.text, textAlign: 'center', width: '100%', marginBottom: 30 }} placeholder="NAME IT" placeholderTextColor={theme.muted + '40'} value={newGoalName} onChangeText={(text) => setNewGoalName(text.toUpperCase())} autoCapitalize="characters" />
                        <View style={{ alignItems: 'center', marginBottom: 40, width: '100%' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.muted, marginBottom: 8 }}>TARGET AMOUNT (Optional)</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 32, fontWeight: '900', color: theme.text, marginRight: 4 }}>₹</Text>
                                <TextInput style={{ fontSize: 32, fontWeight: '900', color: theme.text, minWidth: 50, textAlign: 'center' }} placeholder="0" placeholderTextColor={theme.muted + '40'} keyboardType="numeric" value={newGoalTarget} onChangeText={setNewGoalTarget} />
                            </View>
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={[styles.cancelBtn, { borderColor: theme.border }]}>
                                <Text style={{ color: theme.muted, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateGoal} style={[styles.confirmBtn, { backgroundColor: GOLD_COLOR, shadowColor: GOLD_COLOR }]} disabled={loading}>
                                {loading ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>CREATE</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    sectionHeader: { fontSize: 12, fontWeight: '800', opacity: 0.6, letterSpacing: 0.5 },
    goalCard: { padding: 16, borderRadius: 20, justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    iconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontWeight: '700', fontSize: 11, letterSpacing: 0.5, marginBottom: 2, opacity: 0.8 },
    barBg: { height: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 5, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 5 },
    addCardVertical: { flexDirection: 'row', width: '100%', height: 56, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    fullScreenModal: { flex: 1, paddingTop: 60 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
    bigTitle: { fontSize: 28, fontWeight: '800' },
    closeBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    premiumModal: { width: '100%', borderRadius: 28, padding: 24, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 30, elevation: 20 },
    premiumHeader: { flexDirection: 'row', justifyContent: 'center', width: '100%', alignItems: 'center', marginBottom: 20 },
    premiumTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
    pillContainer: { flexDirection: 'row', width: '100%', borderRadius: 16, padding: 4, height: 50 },
    pill: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
    pillText: { fontWeight: '700', fontSize: 14 },
    hugeInput: { fontSize: 48, fontWeight: '900', minWidth: 50, textAlign: 'center' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 15 },
    cancelBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 16, borderWidth: 1 },
    confirmBtn: { flex: 2, paddingVertical: 16, alignItems: 'center', borderRadius: 16, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    input: { width: '100%', height: 54, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontSize: 17 },
});