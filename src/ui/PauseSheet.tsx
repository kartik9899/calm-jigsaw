import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';

import { useSettingsStore } from '../state/settingsStore';
import { darkColors, lightColors, spacing, typeScale } from './theme';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PauseSheetProps {
  visible: boolean;
  /** Close the sheet and return to play. Also fires on backdrop tap / hardware back. */
  onResume: () => void;
  /** Scatter the board fresh and discard the in-progress save. */
  onRestart: () => void;
  /** Leave the puzzle and return to Home. */
  onQuit: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────────

/**
 * In-game pause sheet (M3-07).
 *
 * Gives the existing Settings toggles (sound / haptics / reduced motion — see
 * src/state/settingsStore.ts) an in-game home, alongside Resume, Restart, and
 * Quit-to-Home. Restart uses a two-step inline confirm rather than a native
 * Alert so the destructive action stays inside the app's calm visual language.
 */
export function PauseSheet({ visible, onResume, onRestart, onQuit }: PauseSheetProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const { sound, haptics, reducedMotion, setSound, setHaptics, setReducedMotion } =
    useSettingsStore();

  // Two-step restart confirm — reset on every close so the sheet never
  // re-opens mid-confirm.
  const [confirmingRestart, setConfirmingRestart] = useState(false);

  const handleResume = () => {
    setConfirmingRestart(false);
    onResume();
  };

  const handleRestart = () => {
    setConfirmingRestart(false);
    onRestart();
  };

  const toggles = [
    { label: 'Sound', value: sound, set: setSound },
    { label: 'Haptics', value: haptics, set: setHaptics },
    { label: 'Reduced motion', value: reducedMotion, set: setReducedMotion },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleResume}>
      <Pressable style={styles.backdrop} onPress={handleResume}>
        {/* Stop taps inside the sheet from bubbling to the dismiss backdrop. */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Paused</Text>

          {toggles.map(({ label, value, set }) => (
            <View key={label} style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
              <Switch
                value={value}
                onValueChange={set}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
          ))}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              onPress={handleResume}
            >
              <Text style={[styles.buttonLabel, { color: colors.accentForeground }]}>Resume</Text>
            </Pressable>

            {confirmingRestart ? (
              <View style={[styles.confirmBox, { borderColor: colors.border }]}>
                <Text style={[styles.confirmText, { color: colors.textSecondary }]}>
                  Restart this puzzle? The pieces scatter again.
                </Text>
                <View style={styles.confirmRow}>
                  <Pressable
                    style={[styles.confirmButton, { borderColor: colors.border }]}
                    onPress={() => setConfirmingRestart(false)}
                  >
                    <Text style={[styles.buttonLabel, { color: colors.textPrimary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmButton, { borderColor: colors.border }]}
                    onPress={handleRestart}
                  >
                    <Text style={[styles.buttonLabel, { color: colors.accent }]}>Restart</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={[styles.button, { borderColor: colors.border }]}
                onPress={() => setConfirmingRestart(true)}
              >
                <Text style={[styles.buttonLabel, { color: colors.textPrimary }]}>Restart</Text>
              </Pressable>
            )}

            <Pressable style={[styles.button, { borderColor: colors.border }]} onPress={onQuit}>
              <Text style={[styles.buttonLabel, { color: colors.textSecondary }]}>
                Quit to Home
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#1C1714AA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    borderRadius: 16,
  },
  title: {
    fontSize: typeScale.heading,
    fontWeight: '300',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: typeScale.body },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: typeScale.body,
    fontWeight: '500',
  },
  confirmBox: {
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  confirmText: {
    fontSize: typeScale.label,
    textAlign: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
