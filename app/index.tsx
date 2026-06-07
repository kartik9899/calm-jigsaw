import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getAllPuzzles } from '../src/content/contentLoader';
import type { PuzzleContent } from '../src/content/types';
import { gridForDifficulty } from '../src/core/generation/grid';
import type { Difficulty } from '../src/core/types';
import { hasSession } from '../src/state/persistence';
import { darkColors, lightColors, spacing, typeScale } from '../src/ui/theme';

const DIFFICULTIES: ReadonlyArray<Difficulty> = [24, 96, 350];

interface ContinuableSession {
  puzzle: PuzzleContent;
  difficulty: Difficulty;
}

/**
 * First in-progress save across the catalogue, in catalogue display order.
 * Mirrors the puzzleId/grid derivation used by the Selection and Play screens
 * (`${puzzle.id}-${difficulty}` + gridForDifficulty) so the lookup matches
 * exactly what usePuzzleSession persisted.
 */
function findContinuable(puzzles: readonly PuzzleContent[]): ContinuableSession | null {
  for (const puzzle of puzzles) {
    for (const difficulty of DIFFICULTIES) {
      const { rows, cols } = gridForDifficulty(difficulty, puzzle.imageAspect);
      if (hasSession(`${puzzle.id}-${difficulty}`, rows, cols)) {
        return { puzzle, difficulty };
      }
    }
  }
  return null;
}

function imageFor(puzzle: PuzzleContent) {
  return typeof puzzle.imageSource === 'number' ? puzzle.imageSource : { uri: puzzle.imageSource };
}

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const puzzles = getAllPuzzles();
  const continuable = findContinuable(puzzles);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.display, { color: colors.textPrimary }]}>Calm Jigsaw</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Choose a photo, pick a difficulty, and piece it together at your own pace.
        </Text>
      </View>

      {continuable && (
        <Pressable
          onPress={() =>
            router.push(
              `/play/${continuable.puzzle.id}?difficulty=${continuable.difficulty}` as never,
            )
          }
          style={({ pressed }) => [
            styles.continueCard,
            {
              backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Image
            source={imageFor(continuable.puzzle)}
            style={[styles.continueImage, { aspectRatio: continuable.puzzle.imageAspect }]}
            resizeMode="cover"
          />
          <View style={styles.continueBody}>
            <Text style={[styles.continueLabel, { color: colors.accent }]}>Continue</Text>
            <Text style={[styles.continueTitle, { color: colors.textPrimary }]}>
              {continuable.puzzle.title}
            </Text>
            <Text style={[styles.continueMeta, { color: colors.textSecondary }]}>
              {continuable.difficulty} pieces · pick up where you left off
            </Text>
          </View>
        </Pressable>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Puzzles</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {puzzles.map((puzzle) => (
          <Pressable
            key={puzzle.id}
            onPress={() => router.push(`/puzzle/${puzzle.id}` as never)}
            style={({ pressed }) => [
              styles.railCard,
              {
                backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Image
              source={imageFor(puzzle)}
              style={[styles.railImage, { aspectRatio: puzzle.imageAspect }]}
              resizeMode="cover"
            />
            <View style={styles.railBody}>
              <Text style={[styles.railTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {puzzle.title}
              </Text>
              <Text style={[styles.railMeta, { color: colors.textSecondary }]}>
                {puzzle.category}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.footerRow}>
        <Pressable onPress={() => router.push('/gallery' as never)} style={styles.footerLink}>
          <Text style={[styles.footerLinkLabel, { color: colors.accent }]}>Gallery</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings' as never)} style={styles.footerLink}>
          <Text style={[styles.footerLinkLabel, { color: colors.accent }]}>Settings</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.base, paddingBottom: spacing.xxl },
  header: { marginTop: spacing.xxxl, marginBottom: spacing.xl },
  display: { fontSize: typeScale.display, fontWeight: '300', letterSpacing: -0.5 },
  sub: { fontSize: typeScale.body, marginTop: spacing.sm, lineHeight: 21 },

  continueCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  continueImage: { width: 96 },
  continueBody: { flex: 1, padding: spacing.base, justifyContent: 'center' },
  continueLabel: {
    fontSize: typeScale.label,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  continueTitle: { fontSize: typeScale.subheading, fontWeight: '500', marginTop: spacing.xs },
  continueMeta: { fontSize: typeScale.label, marginTop: spacing.xs },

  sectionLabel: {
    fontSize: typeScale.label,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  rail: { gap: spacing.md, paddingBottom: spacing.sm },
  railCard: {
    width: 180,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  railImage: { width: '100%' },
  railBody: { padding: spacing.sm },
  railTitle: { fontSize: typeScale.body, fontWeight: '500' },
  railMeta: { fontSize: typeScale.caption, marginTop: spacing.xs },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  footerLink: { padding: spacing.sm },
  footerLinkLabel: { fontSize: typeScale.body },
});
