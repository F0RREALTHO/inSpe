import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from './../context/ThemeContext';
import { useData } from './../context/DataProvider'; // Global Data
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import * as Haptics from 'expo-haptics';

const options = [
  { id: 'Minimal', label: 'Minimal', desc: 'Clean, simple charts. No AI.' },
  { id: 'Detailed', label: 'Detailed', desc: 'Full breakdown, category stats.' },
  { id: 'AI', label: 'AI Powered', desc: 'Smart analysis via Axiom 🤖' },
];

export default function InsightSetting() {
  const router = useRouter();
  const { theme } = useTheme();
  const { userData, refreshData } = useData();

  const current = userData?.insights || "Detailed";

  const handleSelect = async (id: string) => {
    Haptics.selectionAsync();
    
    // 1. Optimistic Update (Optional, but DataProvider is fast enough)
    
    try {
        const user = auth.currentUser;
        if (!user) return;

        // 2. Save to Firestore
        await setDoc(doc(db, "users", user.uid), { insights: id }, { merge: true });
        
        // 3. Sync Global State Immediately
        await refreshData();
        
        router.back();
    } catch (e) {
        console.error(e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Insight Preference</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: 20 }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            onPress={() => handleSelect(opt.id)}
            activeOpacity={0.7}
            style={[
              styles.optionCard, 
              { 
                backgroundColor: theme.card, 
                borderColor: current === opt.id ? theme.accent : 'transparent',
                borderWidth: 2
              }
            ]}
          >
            <View style={{flex: 1}}>
                <Text style={[styles.label, { color: theme.text }]}>{opt.label}</Text>
                <Text style={{ color: theme.muted, marginTop: 4 }}>{opt.desc}</Text>
            </View>
            {current === opt.id && (
                <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: '700' },
  optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      borderRadius: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2
  },
  label: { fontSize: 18, fontWeight: '700' }
});