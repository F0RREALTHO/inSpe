import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, getAdditionalUserInfo, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebaseConfig";
import { useData } from "./context/DataProvider";

// ✅ 1. IMPORT CONSTANTS FOR SAFETY CHECK
import Constants from 'expo-constants';

// ✅ 2. IMPORT GOOGLE SIGN IN (This will still be imported, but we won't run it if in Expo Go)
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

export default function LoginScreen() {
  const router = useRouter();
  const { refreshData } = useData();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  const orb3 = useRef(new Animated.Value(0)).current;
  const floatPulse = useRef(new Animated.Value(1)).current;

  // ✅ 3. CONFIGURE GOOGLE SIGN IN (Wrapped in try-catch to avoid crash on mount in Expo Go)
  useEffect(() => {
    if (Constants.appOwnership !== 'expo') {
      try {
        GoogleSignin.configure({
          webClientId: "585943328144-0khfaau3psnla482fjbvoddr5bcd54sp.apps.googleusercontent.com",
          scopes: ['profile', 'email'],
          offlineAccess: true,
        });
      } catch (e) {
        console.log("Google Signin configure failed:", e);
      }
    }
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(orb1, { toValue: 1, duration: 7000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(orb1, { toValue: 0, duration: 7000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ]),
        Animated.sequence([
          Animated.timing(orb2, { toValue: 1, duration: 10000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(orb2, { toValue: 0, duration: 10000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ]),
        Animated.sequence([
          Animated.timing(orb3, { toValue: 1, duration: 13000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(orb3, { toValue: 0, duration: 13000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ]),
        Animated.sequence([
          Animated.timing(floatPulse, { toValue: 1.02, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(floatPulse, { toValue: 1.0, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ]),
      ])
    ).start();
  }, []);

  const orbStyle = (orb: Animated.Value) => ({
    transform: [
      { translateX: orb.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] }) },
      { translateY: orb.interpolate({ inputRange: [0, 1], outputRange: [-20, 20] }) },
      { scale: orb.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.2] }) },
    ],
    opacity: orb.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] }),
  });

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Missing Info", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Logged In!");
      refreshData();
      router.replace("/(tabs)/home");
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          console.log("Account Created!");
          refreshData();
          router.replace("/onboarding");
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            Alert.alert("Login Failed", "Incorrect password.");
          } else {
            Alert.alert("Registration Error", createErr.message);
          }
        }
      } else {
        Alert.alert("Login Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ 4. SAFETY-CHECKED GOOGLE LOGIN HANDLER
  const handleGoogleLogin = async () => {
    if (Constants.appOwnership === 'expo') {
      Alert.alert(
        "Development Mode",
        "Native Google Sign-In does not work in Expo Go. Please use a Development Build or APK to test Google Login."
      );
      return;
    }

    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Force account picker by signing out first
      try {
        await GoogleSignin.signOut();
      } catch (e) {
      }

      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token found in Google response');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const { isNewUser } = getAdditionalUserInfo(userCredential) || {};

      console.log("Google Logged In! New User:", isNewUser);
      refreshData();

      if (isNewUser) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)/home");
      }

    } catch (error: any) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            console.log("User cancelled login");
            break;
          case statusCodes.IN_PROGRESS:
            Alert.alert("Login in progress", "Please wait...");
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert("Play Services Error", "Google Play Services not available or outdated.");
            break;
          default:
            console.error("Google Sign-In Error", error);
            Alert.alert("Google Login Error", error.message || "Something went wrong");
        }
      } else {
        console.error("Non-Google Error in Login:", error);
        Alert.alert("Login Error", error.message || "An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      <Animated.View style={[styles.orb, styles.orbBig, { backgroundColor: "#D76D7780" }, orbStyle(orb1)]} />
      <Animated.View style={[styles.orb, styles.orbMid, { backgroundColor: "#00F0FF80" }, orbStyle(orb2)]} />
      <Animated.View style={[styles.orb, styles.orbSmall, { backgroundColor: "#8b5cf680" }, orbStyle(orb3)]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        <Animated.View style={[styles.center, { transform: [{ scale: floatPulse }] }]}>
          <Text style={styles.title}>InSpend</Text>
          <Text style={styles.tagline}>Sync. Predict. Control.</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye" : "eye-off"}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>

          </View>

          <Pressable
            onPress={handleAuth}
            style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.98 }] }]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Start My Budget</Text>
            )}
          </Pressable>

          <View style={styles.dividerBox}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>

          <Pressable
            onPress={handleGoogleLogin}
            style={({ pressed }) => [styles.googleBtn, pressed && { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          >
            <Ionicons name="logo-google" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>

          <Text style={styles.hint}>*New here? We'll create an account for you instantly.</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#150C25", justifyContent: "center", overflow: 'hidden' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  center: { width: '85%', alignItems: "center" },
  title: { fontSize: 42, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  tagline: { color: "#cbd5e1", marginTop: 4, marginBottom: 40, fontSize: 16 },

  orb: { position: "absolute", borderRadius: 999, shadowOpacity: 0.5, shadowRadius: 40, elevation: 20 },
  orbBig: { width: 300, height: 300, left: -100, top: -50, shadowColor: '#D76D77' },
  orbMid: { width: 200, height: 200, right: -50, top: 100, shadowColor: '#00F0FF' },
  orbSmall: { width: 150, height: 150, left: 50, bottom: -50, shadowColor: '#8b5cf6' },

  inputContainer: { width: '100%', gap: 15, marginBottom: 25 },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 18,
    color: '#fff',
    fontSize: 16,
    width: '100%'
  },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  passwordInput: { paddingRight: 50 },
  eyeIcon: { position: 'absolute', right: 18, padding: 4 },

  btn: {
    width: '100%',
    backgroundColor: "#D76D77",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: "#D76D77",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16, letterSpacing: 0.5 },

  dividerBox: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  orText: { color: '#9ca3af', paddingHorizontal: 10, fontSize: 12, fontWeight: 'bold' },

  googleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 16
  },
  googleText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  hint: { color: "#64748b", fontSize: 12, marginTop: 25 },
});