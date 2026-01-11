import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'; // ✅ Added onSnapshot
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../../firebaseConfig';

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
  refreshData: async () => { },
});

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>({});
  const [loading, setLoading] = useState(true);

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

      await loadCache(user.uid);

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

        setTransactions(txs);
        AsyncStorage.setItem(`cache_tx_${user.uid}`, JSON.stringify(txs));
      }, (error) => {
        console.log("Tx Listener Error:", error);
      });

      const userDocRef = doc(db, 'users', user.uid);
      unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const uData = docSnap.data();
          setUserData(uData);
          AsyncStorage.setItem(`cache_user_${user.uid}`, JSON.stringify(uData));
        }
        setLoading(false);
      });
    };

    const authUnsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setLoading(true);
        init();
      } else {
        setTransactions([]);
        setUserData({});
        setLoading(false);
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

  const refreshData = async () => {
    console.log("Data is live-synced via onSnapshot");
  };

  return (
    <DataContext.Provider value={{ transactions, userData, loading, refreshData }}>
      {children}
    </DataContext.Provider>
  );
};