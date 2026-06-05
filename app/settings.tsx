import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import { useSettingsStore } from '../src/state/settingsStore';
import { darkColors, lightColors, spacing, typeScale } from '../src/ui/theme';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const { sound, haptics, reducedMotion, setSound, setHaptics, setReducedMotion } =
    useSettingsStore();

  const rows = [
    { label: 'Sound', value: sound, set: setSound },
    { label: 'Haptics', value: haptics, set: setHaptics },
    { label: 'Reduced motion', value: reducedMotion, set: setReducedMotion },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Settings</Text>

      {rows.map(({ label, value, set }) => (
        <View key={label} style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
          <Switch
            value={value}
            onValueChange={set}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
      ))}

      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={[styles.backLabel, { color: colors.accent }]}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.base, paddingTop: spacing.xxxl },
  heading: { fontSize: typeScale.heading, fontWeight: '300', marginBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: typeScale.body },
  backBtn: { marginTop: spacing.xl },
  backLabel: { fontSize: typeScale.body },
});
