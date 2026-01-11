import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
    ActivityIndicator, Platform,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const GOLD_COLOR = "#FFD700";

interface Props {
    onPress: () => void;
    loading?: boolean;
}

export const CreateReportButton = ({ onPress, loading }: Props) => {
    const { theme } = useTheme();

    return (
        <View style={styles.container}>
            <TouchableOpacity
                onPress={() => {
                    Haptics.selectionAsync();
                    onPress();
                }}
                activeOpacity={0.8}
                disabled={loading}
                style={[styles.button, { backgroundColor: theme.card, shadowColor: "#000", borderColor: theme.border }]}
            >
                <View style={[styles.iconContainer, { backgroundColor: GOLD_COLOR }]}>
                    {loading ? (
                        <ActivityIndicator color="#000" size="small" />
                    ) : (
                        <Ionicons name="document-text" size={20} color="#000" />
                    )}
                </View>
                <Text style={[styles.text, { color: theme.text }]}>
                    {loading ? "GENERATING..." : "CREATE REPORT"}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 90,
        alignSelf: 'center',
        zIndex: 9999,
        elevation: 10,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        borderWidth: 1,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    text: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5,
    }
});