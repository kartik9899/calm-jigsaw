import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { darkColors, lightColors, spacing, typeScale } from '../src/ui/theme';

const NAV_LINKS = [
  { label: 'Category', path: '/category/demo' },
  { label: 'Puzzle Select', path: '/puzzle/demo' },
  { label: 'Play (Hello-Skia)', path: '/play/demo' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'Settings', path: '/settings' },
] as const;

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.base }}
    >
      <View style={{ marginTop: spacing.xxxl, marginBottom: spacing.xl }}>
        <Text style={[styles.display, { color: colors.textPrimary }]}>Calm Jigsaw</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>M0 skeleton</Text>
      </View>

      {NAV_LINKS.map(({ label, path }) => (
        <Pressable
          key={path}
          onPress={() => router.push(path as never)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.cardLabel, { color: colors.accent }]}>{label} →</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  display: { fontSize: typeScale.display, fontWeight: '300', letterSpacing: -0.5 },
  sub: { fontSize: typeScale.body, marginTop: spacing.xs },
  card: {
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardLabel: { fontSize: typeScale.body },
});
