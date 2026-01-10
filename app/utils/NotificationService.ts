import Constants from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGoAndroid = Platform.OS === 'android' && (Constants as any)?.appOwnership === 'expo';

const fallbackNotifications = {
  AndroidImportance: { MAX: 5 },
  setNotificationHandler: () => { },
  async getPermissionsAsync() {
    return { status: 'undetermined' };
  },
  async requestPermissionsAsync() {
    return { status: 'denied' };
  },
  async setNotificationChannelAsync() {
    console.log('Notifications: skipping setNotificationChannelAsync in Expo Go on Android');
  },
  async cancelAllScheduledNotificationsAsync() {
    console.log('Notifications: skipping cancelAllScheduledNotificationsAsync (fallback)');
  },
  async scheduleNotificationAsync() {
    console.log('Notifications: skipping scheduleNotificationAsync (fallback)');
    return '';
  },
};

async function loadNotifications() {
  if (isExpoGoAndroid) return fallbackNotifications as any;
  try {
    // dynamic import to avoid module init side-effects in Expo Go
    const mod = await import('expo-notifications');
    return mod as typeof import('expo-notifications');
  } catch (e) {
    console.warn('Could not load expo-notifications, using fallback:', e);
    return fallbackNotifications as any;
  }
}

// Try to set a notification handler if possible (best-effort)
loadNotifications().then((Notifications) => {
  try {
    Notifications.setNotificationHandler?.({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.warn('Failed to set notification handler (fallback):', e);
  }
});

export const NotificationService = {
  requestPermissions: async () => {
    try {
      const Notifications = await loadNotifications();

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync?.('default', {
          name: 'default',
          importance: Notifications.AndroidImportance?.MAX ?? 5,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      console.log('✅ Notification permissions status:', finalStatus);
      return finalStatus === 'granted';
    } catch (e) {
      console.error('❌ Error requesting permissions:', e);
      return false;
    }
  },

  setupPreferences: async (preference: string) => {
    try {
      const Notifications = await loadNotifications();
      await Notifications.cancelAllScheduledNotificationsAsync?.();
      console.log('📋 Cancelled all scheduled notifications');

      if (preference === 'Never') {
        console.log('🔇 Notifications disabled');
        return;
      }

      if (preference === 'Daily insights') {
        await Notifications.scheduleNotificationAsync?.({
          content: {
            title: '💰 Daily Check-in',
            body: "Don't forget to log your expenses today!",
            sound: 'default',
            priority: 'default',
          },
          trigger: { type: 'daily', hour: 9, minute: 0 } as any,
        });
        console.log('✅ Scheduled daily insights notification');
      }

      if (preference === 'Weekly summaries') {
        await Notifications.scheduleNotificationAsync?.({
          content: {
            title: '📊 Weekly Recap',
            body: 'Your weekly spending summary is ready.',
            sound: 'default',
            priority: 'default',
          },
          trigger: { type: 'weekly', weekday: 2, hour: 10, minute: 0 } as any,
        });
        console.log('✅ Scheduled weekly summaries notification');
      }

      if (preference === 'When I overspend') {
        console.log('✅ Overspend notifications enabled (triggered on transaction)');
      }

      if (preference === 'Recurring reminders') {
        await Notifications.scheduleNotificationAsync?.({
          content: {
            title: '📅 Recurring Expense Reminder',
            body: 'Check upcoming recurring transactions.',
            sound: 'default',
            priority: 'default',
          },
          trigger: { type: 'daily', hour: 8, minute: 0 } as any,
        });
        console.log('✅ Scheduled recurring expense reminders');
      }
    } catch (e) {
      console.error('❌ Error setting up preferences:', e);
    }
  },

  triggerOverspendAlert: async (remainingBudget: number) => {
    try {
      const Notifications = await loadNotifications();
      const title = remainingBudget < 0 ? '🛑 Budget Exceeded!' : '⚠️ Low Balance';
      const body = remainingBudget < 0
        ? `You have overspent by ₹${Math.abs(remainingBudget).toLocaleString('en-IN')}.`
        : `You have ₹${remainingBudget.toLocaleString('en-IN')} left to spend safely.`;

      await Notifications.scheduleNotificationAsync?.({
        content: {
          title,
          body,
          sound: 'default',
          priority: 'high',
          badge: 1,
        },
        trigger: null,
      });
      console.log('🔔 Overspend alert sent:', { title, body });
    } catch (e) {
      console.error('❌ Error sending overspend alert:', e);
    }
  },

  triggerBudgetRolloverPrompt: async (unusedBudget: number) => {
    try {
      const Notifications = await loadNotifications();
      await Notifications.scheduleNotificationAsync?.({
        content: {
          title: '🎉 Unused Budget!',
          body: `You had ₹${unusedBudget.toLocaleString('en-IN')} unused last month. Tap to rollover or dismiss.`,
          sound: 'default',
          priority: 'high',
          badge: 1,
        },
        trigger: null,
      });
      console.log('💰 Budget rollover prompt sent');
    } catch (e) {
      console.error('❌ Error sending rollover prompt:', e);
    }
  },

  triggerRecurringReminder: async (reminderText: string) => {
    try {
      const Notifications = await loadNotifications();
      await Notifications.scheduleNotificationAsync?.({
        content: {
          title: '📅 Upcoming Transactions',
          body: reminderText,
          sound: 'default',
          priority: 'default',
          badge: 1,
        },
        trigger: { type: 'daily', hour: 8, minute: 0 } as any,
      });
      console.log('📅 Recurring reminders scheduled for 8 AM');
    } catch (e) {
      console.error('❌ Error scheduling recurring reminders:', e);
    }
  },

  triggerTransactionSyncNotification: async (count: number, lastTx: any) => {
    try {
      const Notifications = await loadNotifications();
      let title = '💸 New Transactions Synced';
      let body = `Synced ${count} new transactions from SMS.`;

      if (count === 1 && lastTx) {
        title = `🆕 New Expense: ₹${lastTx.amount}`;
        body = `${lastTx.note} (${lastTx.category?.label || 'General'})`;
      }

      await Notifications.scheduleNotificationAsync?.({
        content: {
          title,
          body,
          sound: 'default',
          priority: 'high',
          badge: 1,
        },
        trigger: null,
      });
      console.log('🔔 Transaction sync notification sent:', { title, body });
    } catch (e) {
      console.error('❌ Error sending transaction sync notification:', e);
    }
  }
};