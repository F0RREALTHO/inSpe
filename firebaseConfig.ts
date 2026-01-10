import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; 
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBYAWWgnGwgLvS72OYEHkok5G49pPOP_Nw",
  authDomain: "inspend-b6350.firebaseapp.com",
  projectId: "inspend-b6350",
  storageBucket: "inspend-b6350.firebasestorage.app",
  messagingSenderId: "585943328144",
  appId: "1:585943328144:web:c52fa9205e4eb72f60bf15",
  measurementId: "G-FR19P8SZP1"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);

export const storage = getStorage(app);