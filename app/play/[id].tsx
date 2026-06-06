import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JigsawCanvas } from '../../src/engine/JigsawCanvas';
import { spacing, typeScale } from '../../src/ui/theme';

// ── Puzzle configs ────────────────────────────────────────────────────────────

// Hardcoded for M2 de-risk. M3 will derive rows/cols/seed from the puzzle library.
const SAMPLE_PUZZLE = {
  puzzleId: 'sample-4x6',
  rows: 4,
  cols: 6,
  seed: 42,
  imageAspect: 3 / 2,
} as const;

// 14 × 25 = 350 pieces — used for GATE-001 performance measurement.
// Set GATE_MODE = true locally before running the gate; keep false for normal play.
const GATE_PUZZLE = {
  puzzleId: 'gate-14x25',
  rows: 14,
  cols: 25,
  seed: 42,
  imageAspect: 3 / 2,
} as const;

const GATE_MODE = true;
const PUZZLE = GATE_MODE ? GATE_PUZZLE : SAMPLE_PUZZLE;

export default function PlayScreen() {
  return (
    <View style={styles.root}>
      {/* key ensures the canvas (and all its state) resets on new games */}
      <JigsawCanvas
        key={PUZZLE.puzzleId}
        imageSource={require('../../assets/puzzles/sample.png')}
        showPerfOverlay={GATE_MODE}
        {...PUZZLE}
      />

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0EDE8' },
  back: {
    position: 'absolute',
    top: spacing.xxxl,
    left: spacing.base,
    padding: spacing.sm,
    backgroundColor: '#FAF9F7CC',
    borderRadius: 8,
  },
  backLabel: { fontSize: typeScale.body, color: '#6B7FA0' },
});
