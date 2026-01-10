import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import { NotificationService } from "./NotificationService";

const ROLLOVER_MONTH_KEY = "@inspend_rollover_month";

/**
 * Check if budget rollover prompt should be shown
 * Returns: { shouldShow: boolean, unusedBudget: number }
 */
export const checkBudgetRollover = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { shouldShow: false, unusedBudget: 0 };

    // Get current month key (e.g., "2025-12")
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get last month when prompt was shown
    const lastPromptMonth = await AsyncStorage.getItem(ROLLOVER_MONTH_KEY);

    // If already prompted this month, don't show again
    if (lastPromptMonth === currentMonthKey) {
      console.log("✅ Budget rollover already prompted this month");
      return { shouldShow: false, unusedBudget: 0 };
    }

    // Get user data
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return { shouldShow: false, unusedBudget: 0 };

    const data = snap.data();
    const monthlyLimit = data.monthlyLimit || 0;

    if (monthlyLimit === 0) {
      console.log("⚠️ No monthly limit set");
      return { shouldShow: false, unusedBudget: 0 };
    }

    // Calculate last month's spending
    const allTransactions = data.transactions || [];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const lastMonthSpent = (allTransactions || [])
      .filter((t: any) => {
        const txDate = new Date(t.date);
        return (
          t.type === 'expense' &&
          txDate >= lastMonthStart &&
          txDate <= lastMonthEnd
        );
      })
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const unusedBudget = monthlyLimit - lastMonthSpent;

    // Case 1: OVERSPENT (negative balance) - minus from next month
    if (unusedBudget < 0) {
      console.log("💸 Overspend detected:", Math.abs(unusedBudget));
      
      // Mark this month as prompted
      await AsyncStorage.setItem(ROLLOVER_MONTH_KEY, currentMonthKey);

      // Send notification about overspend
      await NotificationService.triggerBudgetRolloverPrompt(unusedBudget);

      return { shouldShow: true, unusedBudget }; // Will be negative
    }

    // Case 2: EXACTLY ON BUDGET (zero balance) - just reset, no prompt
    if (unusedBudget === 0) {
      console.log("🎯 Spent exactly on budget - no rollover needed");
      
      // Mark this month as prompted (no need to ask)
      await AsyncStorage.setItem(ROLLOVER_MONTH_KEY, currentMonthKey);

      return { shouldShow: false, unusedBudget: 0 };
    }

    // Case 3: UNUSED BUDGET (positive balance) - offer to rollover
    if (unusedBudget > 0) {
      console.log("💰 Unused budget found:", unusedBudget);
      
      // Mark this month as prompted
      await AsyncStorage.setItem(ROLLOVER_MONTH_KEY, currentMonthKey);

      // Send notification
      await NotificationService.triggerBudgetRolloverPrompt(unusedBudget);

      return { shouldShow: true, unusedBudget };
    }

    return { shouldShow: false, unusedBudget: 0 };
  } catch (e) {
    console.error("❌ Error checking budget rollover:", e);
    return { shouldShow: false, unusedBudget: 0 };
  }
};

/**
 * Apply rollover: 
 * - If positive: add unused budget to current month limit
 * - If negative: minus overspend from current month limit
 */
export const applyBudgetRollover = async (unusedAmount: number) => {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return false;

    const data = snap.data();
    const currentLimit = data.monthlyLimit || 0;
    const newLimit = Math.max(0, currentLimit + unusedAmount); // Ensure non-negative

    if (unusedAmount > 0) {
      console.log("✅ Budget rollover applied (ADDED):", { from: currentLimit, to: newLimit, added: unusedAmount });
    } else {
      console.log("⚠️ Budget rollover applied (MINUS FROM OVERSPEND):", { from: currentLimit, to: newLimit, deducted: Math.abs(unusedAmount) });
    }

    await setDoc(
      doc(db, "users", user.uid),
      { monthlyLimit: newLimit },
      { merge: true }
    );

    return true;
  } catch (e) {
    console.error("❌ Error applying budget rollover:", e);
    return false;
  }
};

/**
 * Dismiss rollover: don't apply but mark as seen this month
 */
export const dismissBudgetRollover = async () => {
  try {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await AsyncStorage.setItem(ROLLOVER_MONTH_KEY, currentMonthKey);
    console.log("✅ Budget rollover dismissed for this month");
    return true;
  } catch (e) {
    console.error("❌ Error dismissing budget rollover:", e);
    return false;
  }
};
