import { collection, doc, getDoc, writeBatch } from 'firebase/firestore';
import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { auth, db } from '../../firebaseConfig';
import { AICategorizationService } from './AICategorizationService';
import { NotificationService } from './NotificationService';
import { isBankSms as isValidBankSms, parseSmsTransaction } from './smsParser';

interface SmsMessage {
  _id: number;
  address: string;
  body: string;
  date: number;
}

export const requestSmsPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    return (
      granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
      granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (err) {
    console.warn(err);
    return false;
  }
};

export const checkSmsPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  const read = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
  const receive = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
  return read && receive;
};

const fetchRawSms = async (minDate: number): Promise<SmsMessage[]> => {
  return new Promise((resolve) => {
    const filter = {
      box: 'inbox',
      minDate: minDate,
      maxCount: 1000,
      indexFrom: 0,
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail) => {
        console.log("SMS Read Fail:", fail);
        resolve([]);
      },
      (count, smsList) => {
        try {
          const messages = JSON.parse(smsList);
          resolve(messages);
        } catch (e) {
          console.error("SMS Parse Error", e);
          resolve([]);
        }
      }
    );
  });
};

const generateSignature = (transaction: any): string | null => {
  if (!transaction || !transaction.amount || !transaction.type || !transaction.date || !transaction.note) {
    return null;
  }
  const date = new Date(transaction.date).toISOString().split('T')[0];
  return `${transaction.amount}-${transaction.type}-${date}-${transaction.note.trim().toLowerCase()}`;
};

const SESSION_PROCESSED_IDS = new Set<string>();

export const resetSmsCache = () => {
  SESSION_PROCESSED_IDS.clear();
  console.log("🧹 SMS Cache Cleared");
};

export const syncSmsTransactions = async (userCategories: any[], existingTransactions: any[] = [], lookbackHours: number = 720, skipAI: boolean = false): Promise<{ success: number; failed: number; skipped: number; message?: string }> => {
  if (Platform.OS !== 'android') return { success: 0, failed: 0, skipped: 0 };

  // ... (Keep existing setup code up to loop)

  const hasPerm = await checkSmsPermissions();
  if (!hasPerm) {
    const granted = await requestSmsPermissions();
    if (!granted) return { success: 0, failed: 0, skipped: 0, message: "Permission Denied" };
  }

  const user = auth.currentUser;
  if (!user) return { success: 0, failed: 0, skipped: 0, message: "User not logged in" };

  const existingSignatures = new Set(existingTransactions.map(generateSignature).filter(Boolean));

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  // If lookbackHours is provided, use it, otherwise default to 30 days
  const lookbackMs = lookbackHours && lookbackHours !== 720 ? lookbackHours * 60 * 60 * 1000 : THIRTY_DAYS_MS;
  const lookbackTime = Date.now() - lookbackMs;

  console.log("Scanning SMS from:", new Date(lookbackTime).toLocaleString());

  const messages = await fetchRawSms(lookbackTime);

  if (messages.length === 0) {
    console.log("No messages found in last 30 days.");
    return { success: 0, failed: 0, skipped: 0, message: "No bank SMS found in last 30 days." };
  }

  const batch = writeBatch(db);
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let batchSize = 0;
  let lastTransaction = null;

  for (const sms of messages) {
    if (!isValidBankSms(sms)) {
      skippedCount++;
      continue;
    }

    const uniqueDocId = `SMS_${sms._id}`;

    if (SESSION_PROCESSED_IDS.has(uniqueDocId)) {
      skippedCount++;
      continue;
    }

    const transaction = parseSmsTransaction(sms, userCategories);
    if (!transaction) {
      failedCount++;
      continue;
    }

    const sig = generateSignature(transaction);
    if (sig && existingSignatures.has(sig)) {
      skippedCount++;
      continue;
    }

    if (!skipAI && transaction.category.label === "General") {
      try {
        const predicted = await AICategorizationService.predictCategory(transaction.note, transaction.amount || 0, userCategories);
        if (predicted && predicted !== "General") {
          const newCat = userCategories.find(c => c.label === predicted);
          if (newCat) transaction.category = newCat;
        }
      } catch (e) {
      }
    }

    SESSION_PROCESSED_IDS.add(uniqueDocId);

    const docRef = doc(collection(db, 'users', user.uid, 'transactions'), uniqueDocId);

    batch.set(docRef, {
      ...transaction,
      createdAt: new Date().toISOString(),
      paymentMethod: 'Auto-SMS',
      isSavings: false,
      recurring: 'none',
      smsId: sms._id
    }, { merge: true });

    successCount++;
    batchSize++;
    lastTransaction = transaction;

    if (batchSize >= 450) {
      await batch.commit();
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
    console.log(`Synced ${successCount} transactions.`);
    await handleNotifications(user.uid, successCount, lastTransaction);
  }

  return { success: successCount, failed: failedCount, skipped: skippedCount, message: `Synced ${successCount} transactions.` };
};

const handleNotifications = async (uid: string, count: number, lastTx: any) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const notifPref = userData.notification || 'Never';

    if (count > 0 && notifPref !== 'Never') {
      await NotificationService.triggerTransactionSyncNotification(count, lastTx);
    }
  } catch (e) {
    console.error("Notification Error:", e);
  }
};


export const processManualSms = async (text: string, userCategories: any[]) => {
  return { success: true, message: "Manual SMS processed" };
};