import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../../firebaseConfig'; 
import { collection, query, orderBy, limit, doc, onSnapshot } from 'firebase/firestore'; // ✅ Added onSnapshot
import AsyncStorage from '@react-native-async-storage/async-storage';

type DataContextType = {
  transactions: any[];
  userData: any;
  loading: boolean;
  refreshData: () => Promise<void>;
};

const DataContext = createContext<DataContextType>({
  transactions: [],
  userData: {},
  loading: true,
  refreshData: async () => {},
});

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // 1. Load Local Cache (Instant Speed ⚡️)
  const loadCache = async (uid: string) => {
    try {
      const cachedTx = await AsyncStorage.getItem(`cache_tx_${uid}`);
      const cachedUser = await AsyncStorage.getItem(`cache_user_${uid}`);

      if (cachedTx) setTransactions(JSON.parse(cachedTx));
      if (cachedUser) setUserData(JSON.parse(cachedUser));
      
      if (cachedTx || cachedUser) setLoading(false);
    } catch (e) {
      console.log("Cache Error", e);
    }
  };

  useEffect(() => {
    let unsubscribeTransactions: () => void;
    let unsubscribeUser: () => void;

    const init = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      // Load cache first
      await loadCache(user.uid);

      // ✅ 2. REAL-TIME LISTENER: Transactions
      // This runs automatically whenever you add/edit/delete a transaction
      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        orderBy('date', 'desc'),
        limit(100)
      );

      unsubscribeTransactions = onSnapshot(q, (snapshot) => {
        const txs: any[] = [];
        snapshot.forEach((doc) => {
          txs.push({ id: doc.id, ...doc.data() });
        });
        
        // Update State & Cache Instantly
        setTransactions(txs);
        AsyncStorage.setItem(`cache_tx_${user.uid}`, JSON.stringify(txs));
        setLoading(false);
      }, (error) => {
        console.log("Tx Listener Error:", error);
      });

      // ✅ 3. REAL-TIME LISTENER: User Profile
      const userDocRef = doc(db, 'users', user.uid);
      unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const uData = docSnap.data();
          setUserData(uData);
          AsyncStorage.setItem(`cache_user_${user.uid}`, JSON.stringify(uData));
        }
      });
    };

    // Listen for Auth Changes to start/stop listeners
    const authUnsub = auth.onAuthStateChanged((user) => {
      if (user) {
        init();
      } else {
        setTransactions([]);
        setUserData({});
        setLoading(false);
        // Clean up listeners if logged out
        if (unsubscribeTransactions) unsubscribeTransactions();
        if (unsubscribeUser) unsubscribeUser();
      }
    });

    return () => {
      authUnsub();
      if (unsubscribeTransactions) unsubscribeTransactions();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // We keep this function for manual pull-to-refresh, but it's less needed now
  const refreshData = async () => {
     // The listeners handle updates automatically, but we can use this 
     // to force a re-check if needed, or simply do nothing as onSnapshot is live.
     console.log("Data is live-synced via onSnapshot");
  };

  return (
    <DataContext.Provider value={{ transactions, userData, loading, refreshData }}>
      {children}
    </DataContext.Provider>
  );
};