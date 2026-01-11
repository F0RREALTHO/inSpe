import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function SettingsLayout() {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },

        headerTintColor: theme.text,

        headerShadowVisible: false,

        headerTitleStyle: { fontWeight: "bold", fontSize: 18 },
        animation: 'slide_from_right',

        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 15, padding: 5 }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            activeOpacity={0.6}
          >
            <Ionicons name="arrow-back" size={24} color={theme.accent} />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="theme" options={{ title: "Appearance" }} />
      <Stack.Screen name="profilemanagement" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="categories" options={{ headerShown: false }} />
      <Stack.Screen name="numberentry" options={{ headerShown: false }} />
      <Stack.Screen name="haptics" options={{ title: "Haptics", headerShown: false }} />
    </Stack>
  );
}