import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBarBottomInset } from '@/hooks/use-tab-bar-inset';
import { Colors, Typography, BorderRadius } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useAuthStore } from '@/stores/authStore';
import { usePairLocalStore } from '@/stores/pairLocalStore';
import { useSocket } from '@/hooks/useSocket';
import { encryptAnniversary } from '@/services/pairCrypto';
import { ensureSharedSecret } from '@/services/sharedSecret';
import * as Haptics from 'expo-haptics';

/** Local calendar date as YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultDraftDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

export default function CalendarScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const tabBarBottom = useTabBarBottomInset();
  const { sharedSecret, token, isPaired } = useAuthStore();
  const { emitAnniversaryEncrypted } = useSocket(token);
  const savedAnniversaryIso = usePairLocalStore(s => s.anniversaryIso);
  const hydrated = usePairLocalStore(s => s.hydrated);

  /** Draft shown in the picker — always set after hydrate so Save works without scrolling (iOS). */
  const [pickerDate, setPickerDate] = useState<Date>(defaultDraftDate);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (savedAnniversaryIso) {
      setPickerDate(new Date(`${savedAnniversaryIso}T12:00:00`));
    } else {
      setPickerDate(defaultDraftDate());
    }
  }, [hydrated, savedAnniversaryIso]);

  useFocusEffect(
    useCallback(() => {
      void useAuthStore.getState().refreshPairStatus();
    }, [])
  );

  const daysTogether =
    savedAnniversaryIso != null && savedAnniversaryIso !== ''
      ? Math.floor(
          (new Date().getTime() - new Date(`${savedAnniversaryIso}T12:00:00`).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  const pickerIso = toLocalIsoDate(pickerDate);
  const isDirty =
    !savedAnniversaryIso || savedAnniversaryIso === '' || pickerIso !== savedAnniversaryIso;

  const handleValueChange = (_event: DateTimePickerChangeEvent, date: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    setPickerDate(date);
  };

  const handlePickerDismiss = () => {
    if (Platform.OS === 'android') setShowPicker(false);
  };

  const handleSave = async () => {
    if (!hydrated) return;
    setSaving(true);
    try {
      const secret = sharedSecret ?? (await ensureSharedSecret());
      if (!secret) {
        console.warn('Anniversary save skipped: shared secret not ready');
        return;
      }
      const dateStr = toLocalIsoDate(pickerDate);
      const enc = await encryptAnniversary(dateStr, secret);
      emitAnniversaryEncrypted(enc);
      await usePairLocalStore.getState().setAnniversaryIso(dateStr);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to save anniversary:', err);
    } finally {
      setSaving(false);
    }
  };

  const milestones = [
    { days: 30, label: '1 Month', icon: 'leaf' },
    { days: 100, label: '100 Days', icon: 'sparkles' },
    { days: 180, label: '6 Months', icon: 'flower' },
    { days: 365, label: '1 Year', icon: 'heart' },
    { days: 500, label: '500 Days', icon: 'star' },
    { days: 730, label: '2 Years', icon: 'diamond' },
    { days: 1000, label: '1000 Days', icon: 'trophy' },
    { days: 1095, label: '3 Years', icon: 'ribbon' },
  ];

  const nextMilestone = daysTogether !== null
    ? milestones.find(m => m.days > daysTogether)
    : null;

  const completedMilestones = daysTogether !== null
    ? milestones.filter(m => m.days <= daysTogether)
    : [];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingBottom: tabBarBottom },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.springify()}>
          <Text style={[styles.title, { color: colors.text }]}>Our Journey</Text>
        </Animated.View>

        {/* Days Counter */}
        <Animated.View entering={ZoomIn.delay(200).springify()}>
          <GlassCard style={styles.counterCard}>
            <View style={styles.counterContent}>
              {daysTogether !== null ? (
                <>
                  <Text style={[styles.daysNumber, { color: colors.tint }]}>
                    {daysTogether}
                  </Text>
                  <Text style={[styles.daysLabel, { color: colors.textMuted }]}>
                    Days Together
                  </Text>
                  <View style={styles.heartRow}>
                    {[1, 2, 3].map(i => (
                      <Ionicons
                        key={i}
                        name="heart"
                        size={16}
                        color={colors.tint}
                        style={{ opacity: 0.3 + i * 0.2 }}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Ionicons name="calendar" size={40} color={colors.tint} />
                  <Text style={[styles.setDateText, { color: colors.text }]}>
                    Set your anniversary
                  </Text>
                  <Text style={[styles.setDateHint, { color: colors.textMuted }]}>
                    Track your journey together
                  </Text>
                </>
              )}
            </View>
          </GlassCard>
        </Animated.View>

        {/* Anniversary Date Picker */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <GlassCard style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Ionicons name="heart-circle" size={22} color={colors.tint} />
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                Anniversary Date
              </Text>
            </View>

            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                onValueChange={handleValueChange}
                maximumDate={new Date()}
                themeVariant={colorScheme}
                style={styles.datePickerIOS}
              />
            ) : (
              <>
                <Pressable
                  onPress={() => setShowPicker(true)}
                  style={[styles.dateDisplay, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.iconMuted} />
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {pickerDate.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </Pressable>
                {showPicker && (
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    onValueChange={handleValueChange}
                    onDismiss={handlePickerDismiss}
                    maximumDate={new Date()}
                  />
                )}
              </>
            )}

            {!isPaired && (
              <Text style={[styles.hintText, { color: colors.textMuted }]}>
                Pair with your partner to sync your anniversary end-to-end.
              </Text>
            )}

            <GlassButton
              title={isDirty ? 'Save Anniversary' : 'Saved'}
              icon="checkmark-circle"
              onPress={handleSave}
              loading={saving}
              fullWidth
              variant={isDirty ? 'primary' : 'secondary'}
              disabled={saving || !hydrated || !token || !isPaired || !isDirty}
            />
          </GlassCard>
        </Animated.View>

        {/* Next Milestone */}
        {nextMilestone && daysTogether !== null && (
          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <GlassCard style={styles.milestoneCard}>
              <View style={styles.milestoneHeader}>
                <Ionicons name="flag" size={20} color={colors.accent} />
                <Text style={[styles.milestoneTitle, { color: colors.text }]}>
                  Next Milestone
                </Text>
              </View>
              <View style={styles.nextMilestoneContent}>
                <View style={[styles.milestoneIconCircle, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name={nextMilestone.icon as any} size={28} color={colors.accent} />
                </View>
                <Text style={[styles.nextMilestoneName, { color: colors.text }]}>
                  {nextMilestone.label}
                </Text>
                <Text style={[styles.nextMilestoneDays, { color: colors.textMuted }]}>
                  {nextMilestone.days - daysTogether} days to go
                </Text>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* Completed Milestones */}
        {completedMilestones.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              Milestones Reached
            </Text>
            <View style={styles.milestonesGrid}>
              {completedMilestones.map((m, i) => (
                <GlassCard key={m.days} style={styles.completedItem} padding={12}>
                  <View style={[styles.completedIcon, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name={m.icon as any} size={20} color={colors.success} />
                  </View>
                  <Text style={[styles.completedLabel, { color: colors.text }]}>
                    {m.label}
                  </Text>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                </GlassCard>
              ))}
            </View>
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    ...Typography.largeTitle,
    marginBottom: 20,
  },
  counterCard: {
    marginBottom: 16,
  },
  counterContent: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  daysNumber: {
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 72,
  },
  daysLabel: {
    ...Typography.headline,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heartRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  setDateText: {
    ...Typography.title3,
    marginTop: 12,
  },
  setDateHint: {
    ...Typography.footnote,
    marginTop: 4,
  },
  pickerCard: {
    marginBottom: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pickerTitle: {
    ...Typography.headline,
  },
  datePickerIOS: {
    height: 150,
    marginBottom: 12,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
    marginBottom: 16,
  },
  dateText: {
    ...Typography.body,
  },
  hintText: {
    ...Typography.caption1,
    marginBottom: 10,
    textAlign: 'center',
  },
  milestoneCard: {
    marginBottom: 16,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  milestoneTitle: {
    ...Typography.headline,
  },
  nextMilestoneContent: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  milestoneIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextMilestoneName: {
    ...Typography.title3,
  },
  nextMilestoneDays: {
    ...Typography.callout,
  },
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  milestonesGrid: {
    gap: 8,
  },
  completedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
  },
  completedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedLabel: {
    ...Typography.body,
    flex: 1,
  },
});
