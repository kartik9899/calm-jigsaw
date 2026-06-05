import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { darkColors, lightColors, spacing, typeScale } from '../../src/ui/theme';

export default function PuzzleSelectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Puzzle: {id}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Difficulty selection — Placeholder M3
      </Text>
      <Pressable onPress={() => router.push(`/play/${id}` as never)} style={styles.cta}>
        <Text style={[styles.ctaLabel, { color: colors.accentForeground }]}>Start →</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.base, paddingTop: spacing.xxxl },
  heading: { fontSize: typeScale.heading, fontWeight: '300', marginBottom: spacing.sm },
  body: { fontSize: typeScale.body, marginBottom: spacing.xl },
  cta: {
    backgroundColor: '#6B7FA0',
    padding: spacing.base,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ctaLabel: { fontSize: typeScale.subheading },
  back: { fontSize: typeScale.body },
});
