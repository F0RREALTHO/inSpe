import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useData } from '../context/DataProvider';
import { checkSmsPermissions, syncSmsTransactions } from '../utils/SmsService';

const SMS_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const LAST_AUTO_CHECK_KEY = 'last_auto_sms_check';

export default function SmsBackgroundListener() {
  const { userData, transactions } = useData();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const autoImport = userData?.smsAutoImport ?? true;
    if (!autoImport) {
      return;
    }

    const checkAndProcessSms = async () => {
      if (isProcessingRef.current) {
        return;
      }

      try {
        const hasPermission = await checkSmsPermissions();
        if (!hasPermission) {
          return;
        }

        const lastCheck = await AsyncStorage.getItem(LAST_AUTO_CHECK_KEY);
        const now = Date.now();
        if (lastCheck) {
          const timeSinceLastCheck = now - parseInt(lastCheck, 10);
          if (timeSinceLastCheck < SMS_CHECK_INTERVAL) {
          }
        }

        isProcessingRef.current = true;

        const categories = userData?.categories || [];
        // PASS EXISTING TRANSACTIONS + 12 HOURS LOOKBACK + NO AI (Performance)
        const result = await syncSmsTransactions(categories, transactions, 12, true);

        await AsyncStorage.setItem(LAST_AUTO_CHECK_KEY, now.toString());

        if (result.success > 0) {
          console.log(`Auto-imported ${result.success} transaction(s) from SMS`);
        }
      } catch (error) {
        console.error('Error in background SMS processing:', error);
      } finally {
        isProcessingRef.current = false;
      }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        checkAndProcessSms();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    checkAndProcessSms();

    intervalRef.current = setInterval(checkAndProcessSms, SMS_CHECK_INTERVAL);

    return () => {
      subscription.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userData?.smsAutoImport, userData?.categories]);

  return null;
}

