import { Canvas, Fill, Image, Path, Skia, useImage } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typeScale } from '../../src/ui/theme';

// Triangle path — proof that the Skia GPU canvas is rendering
const TRIANGLE_SVG = 'M 140 40 L 260 220 L 20 220 Z';

export default function PlayScreen() {
  // Bundled puzzle sample image (run scripts/create-placeholder-assets.js once first)
  const image = useImage(require('../../assets/puzzles/sample.png'));

  const path = useMemo(() => {
    return Skia.Path.MakeFromSVGString(TRIANGLE_SVG) ?? Skia.Path.Make();
  }, []);

  return (
    <View style={styles.root}>
      {/* Skia canvas — the M2 game board lives here */}
      <Canvas style={styles.canvas}>
        <Fill color="#FAF9F7" />

        {/* Bundled image ✓ */}
        {image && <Image image={image} x={20} y={20} width={240} height={180} fit="cover" />}

        {/* Path ✓ */}
        <Path path={path} color="#6B7FA040" style="fill" />
        <Path path={path} color="#6B7FA0" style="stroke" strokeWidth={2} />
      </Canvas>

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF9F7' },
  canvas: { flex: 1 },
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
