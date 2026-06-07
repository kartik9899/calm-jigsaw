import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getPuzzle } from '../../src/content/contentLoader';
import type { Difficulty } from '../../src/core/types';
import { darkColors, lightColors, spacing, typeScale } from '../../src/ui/theme';

const DIFFICULTIES: ReadonlyArray<{ value: Difficulty; label: string; hint: string }> = [
  { value: 24, label: '24', hint: 'Relaxed' },
  { value: 96, label: '96', hint: 'Balanced' },
  { value: 350, label: '350', hint: 'Challenging' },
];

export default function PuzzleSelectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const puzzle = id ? getPuzzle(id) : null;
  const [difficulty, setDifficulty] = useState<Difficulty>(96);

  if (!puzzle) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>Puzzle not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const previewSource =
    typeof puzzle.imageSource === 'number' ? puzzle.imageSource : { uri: puzzle.imageSource };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Image
        source={previewSource}
        style={[styles.preview, { aspectRatio: puzzle.imageAspect }]}
        resizeMode="cover"
      />

      <Text style={[styles.heading, { color: colors.textPrimary }]}>{puzzle.title}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Choose a difficulty</Text>

      <View style={styles.pillRow}>
        {DIFFICULTIES.map((d) => {
          const selected = d.value === difficulty;
          return (
            <Pressable
              key={d.value}
              onPress={() => setDifficulty(d.value)}
              style={[
                styles.pill,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.pillValue,
                  { color: selected ? colors.accentForeground : colors.textPrimary },
                ]}
              >
                {d.label}
              </Text>
              <Text
                style={[
                  styles.pillHint,
                  { color: selected ? colors.accentForeground : colors.textSecondary },
                ]}
              >
                {d.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push(`/play/${puzzle.id}?difficulty=${difficulty}` as never)}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.ctaLabel, { color: colors.accentForeground }]}>Start Puzzle →</Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.backWrap}>
        <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.base, paddingTop: spacing.xxxl, paddingBottom: spacing.xxl },
  preview: { width: '100%', borderRadius: 14, marginBottom: spacing.lg },
  heading: { fontSize: typeScale.heading, fontWeight: '300', marginBottom: spacing.xs },
  label: { fontSize: typeScale.body, marginBottom: spacing.md },
  pillRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillValue: { fontSize: typeScale.subheading, fontWeight: '600' },
  pillHint: { fontSize: typeScale.caption, marginTop: spacing.xs },
  cta: {
    padding: spacing.base,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ctaLabel: { fontSize: typeScale.subheading, fontWeight: '500' },
  backWrap: { alignItems: 'center' },
  back: { fontSize: typeScale.body },
});
