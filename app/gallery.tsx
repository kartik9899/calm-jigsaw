import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { darkColors, lightColors, spacing, typeScale } from '../src/ui/theme';

export default function GalleryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Gallery</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>Placeholder — M3</Text>
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
  back: { fontSize: typeScale.body },
});
