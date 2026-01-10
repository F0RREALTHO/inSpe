import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useData } from '../context/DataProvider';
import { processSmsTransactions, checkSmsPermissions } from '../utils/SmsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SMS_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const LAST_AUTO_CHECK_KEY = 'last_auto_sms_check';

/**
 * Background component that automatically processes SMS messages
 * when SMS auto-import is enabled
 */
export default function SmsBackgroundListener() {
  const { userData } = useData();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // Only run if SMS auto-import is enabled
    if (!userData?.smsAutoImport) {
      return;
    }

    const checkAndProcessSms = async () => {
      // Prevent multiple simultaneous checks
      if (isProcessingRef.current) {
        return;
      }

      try {
        // Check if permissions are granted
        const hasPermission = await checkSmsPermissions();
        if (!hasPermission) {
          return;
        }

        // Check if enough time has passed since last check
        const lastCheck = await AsyncStorage.getItem(LAST_AUTO_CHECK_KEY);
        const now = Date.now();
        if (lastCheck) {
          const timeSinceLastCheck = now - parseInt(lastCheck, 10);
          if (timeSinceLastCheck < SMS_CHECK_INTERVAL) {
            return;
          }
        }

        isProcessingRef.current = true;

        // Process SMS transactions
        const categories = userData?.categories || [];
        const result = await processSmsTransactions(categories);

        // Update last check timestamp
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

    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground, check SMS immediately
        checkAndProcessSms();
      }
      appStateRef.current = nextAppState;
    };

    // Set up app state listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initial check when component mounts
    checkAndProcessSms();

    // Set up periodic checks
    intervalRef.current = setInterval(checkAndProcessSms, SMS_CHECK_INTERVAL);

    // Cleanup
    return () => {
      subscription.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userData?.smsAutoImport, userData?.categories]);

  // This component doesn't render anything
  return null;
}

