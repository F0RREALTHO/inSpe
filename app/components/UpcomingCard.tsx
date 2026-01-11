import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function UpcomingCard({ item, theme, onConfirm }: any) {

  const calculateNextDate = () => {
    const originalDate = item.date ? new Date(item.date) : new Date();
    const now = new Date();
    let nextDate = new Date();

    if (item.recurring === 'daily') {
      nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (item.recurring === 'weekly') {
      nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    } else if (item.recurring === 'monthly') {
      nextDate = new Date(now.getFullYear(), now.getMonth(), originalDate.getDate());
    }

    return nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  };

  const nextOccurrence = calculateNextDate();
  const catColor = item.category?.color || theme.accent || '#6b7280';
  const catEmoji = item.category?.emoji || '💰';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onConfirm(item)}
      activeOpacity={0.6}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.iconWrapper,
            {
              borderColor: catColor,
              backgroundColor: catColor + '15',
              shadowColor: catColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 4
            }
          ]}
        >
          <Text style={{ fontSize: 22 }}>{catEmoji}</Text>

          <View style={[styles.reloadBadge, { backgroundColor: theme.card, borderColor: theme.bg }]}>
            <Ionicons name="refresh" size={10} color={theme.text} />
          </View>
        </View>

        <View style={styles.details}>
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            {item.title || item.category?.label || 'Transaction'}
          </Text>

          <View style={styles.subRow}>
            <Text style={[styles.dateText, { color: theme.muted }]}>
              {nextOccurrence}
            </Text>
            {item.note && (
              <>
                <Text style={{ color: theme.muted, marginHorizontal: 4, opacity: 0.5 }}>•</Text>
                <Text style={[styles.categoryText, { color: theme.muted, opacity: 0.8 }]}>
                  {item.category?.label}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.amountWrapper}>
          <Text style={[styles.amount, { color: theme.muted }]}>
            -₹{item.amount?.toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    width: '100%',
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  reloadBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  details: {
    flex: 1,
    marginLeft: 16,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountWrapper: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.8,
  },
});