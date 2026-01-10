import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { deleteUser, signOut } from "firebase/auth";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebaseConfig";
import { useTheme } from "../context/ThemeContext";
import { useData } from "./../context/DataProvider";

export default function ProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme(); 
  
  const { userData } = useData();

  const displayName = userData?.displayName || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const handle = `${displayName.replace(/\s+/g, '').toLowerCase()}@in.spend`;

  // --- ACTIONS ---
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleDelete = () => {
    Alert.alert(
        "Delete Account", 
        "Are you sure? This action is permanent and cannot be undone.", 
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                    try {
                        if(auth.currentUser) await deleteUser(auth.currentUser);
                        router.replace("/");
                    } catch (e: any) {
                        Alert.alert("Security Check", "Please log in again before deleting your account.");
                    }
                }
            }
        ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        {/* Profile Header */}
        <View style={{alignItems: 'center', marginVertical: 40}}>
            <View style={[styles.avatar, {backgroundColor: theme.accent, shadowColor: theme.accent }]}>
                <Text style={{fontSize: 40, fontWeight: 'bold', color: '#fff'}}>
                    {initial}
                </Text>
            </View>
            <Text style={[styles.name, {color: theme.text}]}>
                {displayName}
            </Text>
            <Text style={{color: theme.muted}}>
                {handle}
            </Text>
        </View>

        {/* Menu */}
        <View style={[styles.menu, {backgroundColor: theme.card}]}>
            <TouchableOpacity style={styles.row} onPress={() => router.push("/setting")}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="settings-outline" size={22} color={theme.text} />
                    <Text style={[styles.rowText, {color: theme.text}]}>App Settings</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.muted} />
            </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <Text style={{color: theme.muted, marginTop: 30, marginBottom: 10, marginLeft: 10, fontSize: 12, fontWeight: 'bold'}}>ACCOUNT ACTIONS</Text>
        <View style={[styles.menu, {backgroundColor: theme.card}]}>
            
            <TouchableOpacity style={styles.row} onPress={handleSignOut}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="log-out-outline" size={22} color={theme.text} />
                    <Text style={[styles.rowText, {color: theme.text}]}>Sign Out</Text>
                </View>
            </TouchableOpacity>

             <View style={{height: 1, backgroundColor: theme.border}} />

            <TouchableOpacity style={styles.row} onPress={handleDelete}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
                    <Text style={[styles.rowText, {color: "#ff6b6b"}]}>Delete Account</Text>
                </View>
            </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  avatar: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 15, 
    shadowOpacity: 0.5, 
    shadowRadius: 20, 
    elevation: 10 
  },
  name: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  menu: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 18, justifyContent: 'space-between' },
  rowText: { fontSize: 16, fontWeight: '600', marginLeft: 15 }
});