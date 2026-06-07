import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { getAllPuzzles, getPuzzle } from '../../src/content/contentLoader';
import type { PuzzleContent } from '../../src/content/types';
import { gridForDifficulty } from '../../src/core/generation/grid';
import type { Difficulty } from '../../src/core/types';
import { JigsawCanvas } from '../../src/engine/JigsawCanvas';
import { spacing, typeScale } from '../../src/ui/theme';

// ── GATE-001 perf harness (unchanged from M2) ────────────────────────────────
// 14 × 25 = 350 pieces — used for GATE-001 performance measurement.
// Set GATE_MODE = true locally before running the gate; keep false for normal play.
// This bypasses the content layer entirely with a fixed de-risk config.
const GATE_MODE = false;
const GATE_PUZZLE = {
  puzzleId: 'gate-14x25',
  rows: 14,
  cols: 25,
  seed: 42,
  imageAspect: 3 / 2,
} as const;

// ── Difficulty param parsing ─────────────────────────────────────────────────

const VALID_DIFFICULTIES: ReadonlyArray<Difficulty> = [24, 96, 350];

function parseDifficulty(raw: string | undefined): Difficulty {
  const n = Number(raw);
  return (VALID_DIFFICULTIES as ReadonlyArray<number>).includes(n) ? (n as Difficulty) : 96;
}

// ── Completion overlay (M3-05) ───────────────────────────────────────────────

interface CompletionOverlayProps {
  puzzle: PuzzleContent;
  pieceCount: number;
  /** null when there is no other bundled puzzle to suggest. */
  onNext: (() => void) | null;
  onBack: () => void;
}

/**
 * Shown once the final two groups snap together.
 *
 * Per M3-05: a single baked-image dissolve (the whole photo fades in over the
 * assembled board, smoothing piece seams away in one calm motion — NOT a
 * per-piece reveal), followed by a quiet success line and Next/Back actions.
 */
function CompletionOverlay({ puzzle, pieceCount, onNext, onBack }: CompletionOverlayProps) {
  const dissolve = useRef(new Animated.Value(0)).current;
  const details = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(dissolve, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(details, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, [dissolve, details]);

  const source =
    typeof puzzle.imageSource === 'number' ? puzzle.imageSource : { uri: puzzle.imageSource };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.Image
        source={source}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { opacity: dissolve }]}
      />

      <Animated.View style={[styles.completionPanel, { opacity: details }]}>
        <Text style={styles.completionTitle}>{puzzle.title}</Text>
        <Text style={styles.completionLine}>All {pieceCount} pieces found their place.</Text>
        <View style={styles.completionActions}>
          {onNext && (
            <Pressable
              style={[styles.completionButton, styles.completionButtonPrimary]}
              onPress={onNext}
            >
              <Text style={styles.completionButtonPrimaryLabel}>Next →</Text>
            </Pressable>
          )}
          <Pressable style={styles.completionButton} onPress={onBack}>
            <Text style={styles.completionButtonLabel}>← Back to puzzles</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PlayScreen() {
  const { id, difficulty: difficultyParam } = useLocalSearchParams<{
    id: string;
    difficulty?: string;
  }>();
  const [showReference, setShowReference] = useState(false);
  const [solved, setSolved] = useState(false);

  // GATE_MODE bypasses routing/content entirely — fixed perf-measurement config.
  if (GATE_MODE) {
    return (
      <View style={styles.root}>
        <JigsawCanvas
          key={GATE_PUZZLE.puzzleId}
          imageSource={require('../../assets/puzzles/sample.png')}
          showPerfOverlay
          {...GATE_PUZZLE}
        />
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backLabel}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const content = id ? getPuzzle(id) : null;

  if (!content) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.missingText}>Puzzle not found.</Text>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backLabel}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const difficulty = parseDifficulty(difficultyParam);
  const { rows, cols } = gridForDifficulty(difficulty, content.imageAspect);
  const puzzleId = `${content.id}-${difficulty}`;

  const referenceSource =
    typeof content.imageSource === 'number' ? content.imageSource : { uri: content.imageSource };

  // Suggest the next bundled puzzle (wraps around); null when there's only one.
  const allPuzzles = getAllPuzzles();
  const currentIndex = allPuzzles.findIndex((p) => p.id === content.id);
  const nextPuzzle =
    allPuzzles.length > 1 ? allPuzzles[(currentIndex + 1) % allPuzzles.length] : null;

  return (
    <View style={styles.root}>
      {/* key ensures the canvas (and all its state) resets when puzzle/difficulty changes */}
      <JigsawCanvas
        key={puzzleId}
        imageSource={content.imageSource}
        puzzleId={puzzleId}
        rows={rows}
        cols={cols}
        seed={42}
        imageAspect={content.imageAspect}
        onComplete={() => setSolved(true)}
      />

      {/* Hide in-game chrome once solved — the completion panel owns the moment. */}
      {!solved && (
        <>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backLabel}>← Back</Text>
          </Pressable>

          <Pressable style={styles.referenceButton} onPress={() => setShowReference(true)}>
            <Text style={styles.referenceButtonLabel}>Reference</Text>
          </Pressable>
        </>
      )}

      <Modal
        visible={showReference}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReference(false)}
      >
        <Pressable style={styles.referenceBackdrop} onPress={() => setShowReference(false)}>
          <Image
            source={referenceSource}
            style={[styles.referenceImage, { aspectRatio: content.imageAspect }]}
            resizeMode="contain"
          />
          <Text style={styles.referenceHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>

      {solved && (
        <CompletionOverlay
          puzzle={content}
          pieceCount={rows * cols}
          onNext={nextPuzzle ? () => router.replace(`/puzzle/${nextPuzzle.id}` as never) : null}
          onBack={() => router.replace('/' as never)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0EDE8' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  missingText: { fontSize: typeScale.subheading, color: '#5C5247', marginBottom: spacing.base },
  back: {
    position: 'absolute',
    top: spacing.xxxl,
    left: spacing.base,
    padding: spacing.sm,
    backgroundColor: '#FAF9F7CC',
    borderRadius: 8,
  },
  backLabel: { fontSize: typeScale.body, color: '#6B7FA0' },
  referenceButton: {
    position: 'absolute',
    top: spacing.xxxl,
    right: spacing.base,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#FAF9F7CC',
    borderRadius: 8,
  },
  referenceButtonLabel: { fontSize: typeScale.body, color: '#6B7FA0', fontWeight: '500' },
  referenceBackdrop: {
    flex: 1,
    backgroundColor: '#000000CC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  referenceImage: {
    width: '100%',
    borderRadius: 12,
  },
  referenceHint: {
    marginTop: spacing.base,
    fontSize: typeScale.label,
    color: '#FAF9F7AA',
  },
  completionPanel: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: spacing.xxl,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#1C1714CC',
    alignItems: 'center',
  },
  completionTitle: {
    fontSize: typeScale.heading,
    fontWeight: '300',
    color: '#FAF9F7',
    marginBottom: spacing.xs,
  },
  completionLine: {
    fontSize: typeScale.body,
    color: '#E0D9D0',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  completionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  completionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FAF9F744',
  },
  completionButtonLabel: {
    fontSize: typeScale.body,
    color: '#FAF9F7',
  },
  completionButtonPrimary: {
    backgroundColor: '#6B7FA0',
    borderColor: '#6B7FA0',
  },
  completionButtonPrimaryLabel: {
    fontSize: typeScale.body,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
