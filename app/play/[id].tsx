import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { getPuzzle } from '../../src/content/contentLoader';
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

export default function PlayScreen() {
  const { id, difficulty: difficultyParam } = useLocalSearchParams<{
    id: string;
    difficulty?: string;
  }>();
  const [showReference, setShowReference] = useState(false);

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
      />

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>

      <Pressable style={styles.referenceButton} onPress={() => setShowReference(true)}>
        <Text style={styles.referenceButtonLabel}>Reference</Text>
      </Pressable>

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
});
