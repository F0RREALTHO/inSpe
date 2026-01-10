import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { auth, db } from '../../firebaseConfig';
import { AICategorizationService } from './AICategorizationService';
import { NotificationService } from './NotificationService';
import { isBankSms, parseSmsTransaction } from './smsParser';

interface SmsMessage {
  address: string;
  body: string;
  date: number;
  dateSent?: number;
}

const LAST_SMS_CHECK_KEY = 'last_sms_check_timestamp';
const PROCESSED_SMS_IDS_KEY = 'processed_sms_ids';

/**
 * Request SMS permissions on Android
 */
export const requestSmsPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);

    const readSmsGranted = granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    const receiveSmsGranted = granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;

    return readSmsGranted && receiveSmsGranted;
  } catch (err) {
    console.warn('Permission request error:', err);
    return false;
  }
};

/**
 * Check if SMS permissions are granted
 */
export const checkSmsPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const readSms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
    const receiveSms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
    return readSms && receiveSms;
  } catch (err) {
    return false;
  }
};

/**
 * Read SMS messages from device
 */
export const readSmsMessages = async (maxCount: number = 100): Promise<SmsMessage[]> => {
  if (Platform.OS !== 'android') {
    return [];
  }

  const hasPermission = await checkSmsPermissions();
  if (!hasPermission) {
    throw new Error('SMS permissions not granted');
  }

  return new Promise((resolve, reject) => {
    // 5-second timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      // Instead of rejecting, we resolve with empty array to prevent crashing the flow
      // But we log it.
      console.warn("SMS read timed out");
      resolve([]);
    }, 5000);

    const filter = {
      box: 'inbox',
      maxCount: maxCount,
      sort: 'date',
      order: 'DESC'
    };

    try {
      SmsAndroid.list(
        JSON.stringify(filter),
        (fail: string) => {
          clearTimeout(timeoutId);
          console.log("SMS List Failed:", fail);
          resolve([]);
        },
        (count: number, smsList: string) => {
          clearTimeout(timeoutId);
          try {
            const messages: SmsMessage[] = JSON.parse(smsList);
            resolve(messages);
          } catch (e) {
            console.error("Failed to parse SMS JSON", e);
            resolve([]);
          }
        }
      );
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("SMS List Exception", e);
      resolve([]);
    }
  });
};

/**
 * Get unprocessed SMS messages since last check
 */
export const getUnprocessedSms = async (): Promise<SmsMessage[]> => {
  try {
    const lastCheck = await AsyncStorage.getItem(LAST_SMS_CHECK_KEY);
    // Be more aggressive: Only look back 30 days max if no last check, otherwise default to "now" logic
    const lastTimestamp = lastCheck ? parseInt(lastCheck, 10) : Date.now() - (30 * 24 * 60 * 60 * 1000);

    // REDUCED BATCH SIZE: 150 messages is plenty for "Recent"
    const allSms = await readSmsMessages(150);

    // Filter SMS from banks and after last check
    const bankSms = allSms.filter(sms => {
      const smsDate = sms.date || sms.dateSent || 0;
      return isBankSms(sms) && smsDate > lastTimestamp;
    });

    // Get processed SMS IDs
    const processedIds = await getProcessedSmsIds();

    // Filter out already processed SMS
    const unprocessed = bankSms.filter(sms => {
      const smsId = `${sms.address}_${sms.date}_${sms.body?.substring(0, 20)}`;
      return !processedIds.has(smsId);
    });

    return unprocessed;
  } catch (error) {
    console.error('Error getting unprocessed SMS:', error);
    return [];
  }
};

/**
 * Process SMS messages and add transactions to Firestore
 */
export const processSmsTransactions = async (userCategories: any[]): Promise<{ success: number; failed: number }> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const unprocessedSms = await getUnprocessedSms();
  let successCount = 0;
  let failedCount = 0;
  const processedIds: string[] = [];
  let lastTransaction = null;

  for (const sms of unprocessedSms) {
    try {
      const transaction = parseSmsTransaction(sms, userCategories);
      const smsId = `${sms.address}_${sms.date}_${sms.body?.substring(0, 20)}`;

      if (!transaction) {
        processedIds.push(smsId);
        continue;
      }

      // --- AI CATEGORIZATION START ---
      // If the parsed category is "General" (meaning fallback), try AI
      if (transaction.category.label === "General") {
         const predictedLabel = await AICategorizationService.predictCategory(transaction.note, transaction.amount || 0, userCategories);
         if (predictedLabel && predictedLabel !== "General") {
            const newCat = userCategories.find(c => c.label === predictedLabel);
            if (newCat) transaction.category = newCat;
         }
      }
      // --- AI CATEGORIZATION END ---

      // Check if transaction already exists (prevent duplicates) via Firestore query
      // Optimization: This loop awaits sequentially, which is slow but safe.
      const txRef = collection(db, 'users', user.uid, 'transactions');
      const q = query(
        txRef,
        where('date', '==', transaction.date),
        where('amount', '==', transaction.amount),
        limit(1)
      );

      const existing = await getDocs(q);
      if (!existing.empty) {
        processedIds.push(smsId);
        continue;
      }

      // Add transaction to Firestore
      await addDoc(txRef, {
        ...transaction,
        createdAt: new Date().toISOString(),
        paymentMethod: transaction.paymentMethod,
        isSavings: false,
        recurring: 'none'
      });

      successCount++;
      lastTransaction = transaction;
      processedIds.push(smsId);
    } catch (error) {
      console.error('Error processing SMS transaction:', error);
      failedCount++;
    }
  }

  // Update processed SMS IDs
  if (processedIds.length > 0) {
    await addProcessedSmsIds(processedIds);
  }

  // Update last check timestamp
  await AsyncStorage.setItem(LAST_SMS_CHECK_KEY, Date.now().toString());

  // 🔔 NOTIFICATIONS & OVERSPEND LOGIC
  if (successCount > 0) {
    try {
      // 1. Fetch User Preferences to check notification settings
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const notificationPref = userData.notification || 'Never';
        const monthlyLimit = userData.monthlyLimit || 0;
        const notificationThreshold = userData.notificationThreshold || 1000;

        // 2. Trigger Sync Notification (if not "Never")
        if (notificationPref !== 'Never') {
          await NotificationService.triggerTransactionSyncNotification(successCount, lastTransaction);
        }

        // 3. Overspend Logic (Only if enabled)
        if (notificationPref === 'When I overspend' && monthlyLimit > 0) {
          // Calculate current month's expenses
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

          const txRef = collection(db, 'users', user.uid, 'transactions');
          // Note: Firestore string filtering for ISO dates works for >=
          const q = query(
            txRef,
            where('date', '>=', monthStart),
            where('type', '==', 'expense')
          );

          const snapshot = await getDocs(q);
          const currentSpend = snapshot.docs.reduce((sum, doc) => sum + Number(doc.data().amount), 0);
          const remaining = monthlyLimit - currentSpend;

          // Check if we breached the threshold or went negative
          if (remaining < 0 || remaining < notificationThreshold) {
            await NotificationService.triggerOverspendAlert(remaining);
          }
        }
      }
    } catch (e) {
      console.error("Error triggering notifications inside SmsService:", e);
    }
  }

  return { success: successCount, failed: failedCount };
};


/**
 * Get processed SMS IDs from storage
 */
const getProcessedSmsIds = async (): Promise<Set<string>> => {
  try {
    const stored = await AsyncStorage.getItem(PROCESSED_SMS_IDS_KEY);
    if (stored) {
      const ids = JSON.parse(stored);
      return new Set(ids);
    }
  } catch (error) {
    console.error('Error getting processed SMS IDs:', error);
  }
  return new Set();
};

/**
 * Add processed SMS IDs to storage
 */
const addProcessedSmsIds = async (newIds: string[]): Promise<void> => {
  try {
    const existing = await getProcessedSmsIds();
    const combined = new Set([...existing, ...newIds]);

    // Keep only last 500 IDs to prevent storage bloat
    const idsArray = Array.from(combined);
    const trimmed = idsArray.slice(-500);

    await AsyncStorage.setItem(PROCESSED_SMS_IDS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error saving processed SMS IDs:', error);
  }
};

/**
 * Manually sync SMS transactions
 */
export const syncSmsTransactions = async (userCategories: any[]): Promise<{ success: number; failed: number }> => {
  if (Platform.OS !== 'android') {
    return { success: 0, failed: 0 };
  }

  const hasPermission = await checkSmsPermissions();
  if (!hasPermission) {
    const granted = await requestSmsPermissions();
    if (!granted) {
      throw new Error('SMS permissions required');
    }
  }

  return await processSmsTransactions(userCategories);
};

/**
 * Process a manually pasted SMS text (for testing/Expo Go)
 * logic mirrors processSmsTransactions but handles single text + category updates
 */
export const processManualSms = async (text: string, userCategories: any[]): Promise<{ success: boolean; message: string }> => {
  const user = auth.currentUser;
  if (!user) return { success: false, message: "User not logged in" };

  // 1. Create a mock SMS object
  const mockSms: SmsMessage = {
    address: "MANUAL_INPUT",
    body: text,
    date: Date.now(),
  };

  // 2. Parse it using the existing logic
  const transaction = parseSmsTransaction(mockSms, userCategories);

  if (!transaction) {
    return { success: false, message: "Could not parse a transaction from this text." };
  }

  try {
    // --- AI CATEGORIZATION START (MANUAL PASTE) ---
    if (transaction.category.label === "General") {
        const predictedLabel = await AICategorizationService.predictCategory(transaction.note, transaction.amount || 0, userCategories);
        if (predictedLabel && predictedLabel !== "General") {
            const newCat = userCategories.find(c => c.label === predictedLabel);
            if (newCat) transaction.category = newCat;
        }
    }
    // --- AI CATEGORIZATION END ---

    // 3. Check for duplicates (simple check based on date/amount/note)
    // For manual entry, we might want to allow it, but let's check exact match to be safe
    const txRef = collection(db, 'users', user.uid, 'transactions');
    // Using date matching might be tricky if "now" is used, so we rely on user intent.
    // But let's check if there's a transaction with same amount and roughly same time? 
    // No, for manual paste, assume user wants to add it.

    // 4. Handle New Category Logic (Referencing PDF Parser approach)
    // Check if the assigned category exists in the user's current list
    const existingCategory = userCategories.find(c => c.label === transaction.category.label);

    if (!existingCategory) {
      // It's a new category! We need to add it to the user's profile.
      // PDF parser does this by updating the user doc.
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const currentCategories = userData.categories || [];
        const currentIncomeCategories = userData.incomeCategories || [];

        // Determine if it's income or expense to put in right list (though structure is unified mostly)
        // The transaction object has 'type'.
        if (transaction.type === 'income') {
          const updatedIncomeCats = [...currentIncomeCategories, transaction.category];
          await updateDoc(userDocRef, { incomeCategories: updatedIncomeCats });
        } else {
          const updatedExpenseCats = [...currentCategories, transaction.category];
          await updateDoc(userDocRef, { categories: updatedExpenseCats });
        }
      }
    }

    // 5. Add Transaction to Firestore
    await addDoc(txRef, {
      ...transaction,
      createdAt: new Date().toISOString(),
      paymentMethod: transaction.paymentMethod,
      isSavings: false,
      recurring: 'none',
      isManualSms: true
    });

    // 6. Check for Overspend (Manual Entry)
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Check if user wants overspend notifications
        if (userData.notification === 'When I overspend' && userData.monthlyLimit > 0) {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const q = query(
            collection(db, 'users', user.uid, 'transactions'),
            where('date', '>=', monthStart),
            where('type', '==', 'expense')
          );
          const snapshot = await getDocs(q);
          const currentSpend = snapshot.docs.reduce((sum, doc) => sum + Number(doc.data().amount), 0);
          const remaining = userData.monthlyLimit - currentSpend;
          const threshold = userData.notificationThreshold || 1000;

          if (remaining < 0 || remaining < threshold) {
            await NotificationService.triggerOverspendAlert(remaining);
          }
        }
      }
    } catch (e) {
      console.warn("Manual SMS overspend check failed", e);
    }

    return { success: true, message: `Added ${transaction.type}: ₹${transaction.amount} at ${transaction.note}` };

  } catch (error: any) {
    console.error("Manual SMS Process Error:", error);
    return { success: false, message: error.message || "Error saving transaction." };
  }
};
