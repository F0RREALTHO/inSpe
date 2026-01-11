import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import { NotificationService } from "./NotificationService";

const ROLLOVER_MONTH_KEY = "@inspend_rollover_month";

export const checkBudgetRollover = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { shouldShow: false, unusedBudget: 0 };

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const lastPromptMonth = await AsyncStorage.getItem(ROLLOVER_MONTH_KEY);

    if (lastPromptMonth === currentMonthKey) {
      console.log("✅ Budget rollover already prompted this month");
      return { shouldShow: false, unusedBudget: 0 };
    }

    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return { shouldShow: false, unusedBudget: 0 };

    const data = snap.data();
    const monthlyLimit = data.monthlyLimit || 0;

    if (monthlyLimit === 0) {
      console.log("⚠️ No monthly limit set");
      return { shouldShow: false, unusedBudget: 0 };
    }

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

    if (unusedBudget < 0) {
      console.log("💸 Overspend detected:", Math.abs(unusedBudget));

      await AsyncStorage.setItem(ROLLOVER_MONTH_KEY, currentMonthKey);

      await NotificationService.triggerBudgetRolloverPrompt(unusedBudget);

      return { shouldShow: true, unusedBudget };
    }

    if (unusedBudget === 0) {
      console.log("🎯 Spent exactly on budget - no rollover needed");

      await AsyncStorage.setItem(ROLLOVER_MONTH_KEY, currentMonthKey);

      return { shouldShow: false, unusedBudget: 0 };
    }

    if (unusedBudget > 0) {
      console.log("💰 Unused budget found:", unusedBudget);

      await AsyncStorage.setItem(ROLLOVER_MONTH_KEY, currentMonthKey);

      await NotificationService.triggerBudgetRolloverPrompt(unusedBudget);

      return { shouldShow: true, unusedBudget };
    }

    return { shouldShow: false, unusedBudget: 0 };
  } catch (e) {
    console.error("❌ Error checking budget rollover:", e);
    return { shouldShow: false, unusedBudget: 0 };
  }
};

export const applyBudgetRollover = async (unusedAmount: number) => {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return false;

    const data = snap.data();
    const currentLimit = data.monthlyLimit || 0;
    const newLimit = Math.max(0, currentLimit + unusedAmount);
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
