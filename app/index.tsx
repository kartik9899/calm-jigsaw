import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getAllPuzzles } from '../src/content/contentLoader';
import { darkColors, lightColors, spacing, typeScale } from '../src/ui/theme';

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;

  // M3 foundation ships one bundled puzzle — feature it directly so the
  // home screen reads as "here's a puzzle, tap it to play" rather than a menu.
  const featured = getAllPuzzles()[0] ?? null;

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

      {featured && (
        <Pressable
          onPress={() => router.push(`/puzzle/${featured.id}` as never)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Image
            source={
              typeof featured.imageSource === 'number'
                ? featured.imageSource
                : { uri: featured.imageSource }
            }
            style={[styles.cardImage, { aspectRatio: featured.imageAspect }]}
            resizeMode="cover"
          />
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{featured.title}</Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {featured.category} · tap to choose a difficulty
            </Text>
          </View>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.base, paddingBottom: spacing.xxl },
  header: { marginTop: spacing.xxxl, marginBottom: spacing.xl },
  display: { fontSize: typeScale.display, fontWeight: '300', letterSpacing: -0.5 },
  sub: { fontSize: typeScale.body, marginTop: spacing.sm, lineHeight: 21 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardImage: { width: '100%' },
  cardBody: { padding: spacing.base },
  cardTitle: { fontSize: typeScale.subheading, fontWeight: '500' },
  cardMeta: { fontSize: typeScale.label, marginTop: spacing.xs },
});
