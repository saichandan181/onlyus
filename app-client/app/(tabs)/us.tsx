import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, ScrollView, RefreshControl, Platform } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAccessibilitySettings } from '@/hooks/use-accessibility-settings';
import { Typography, BorderRadius, MoodIcons } from '@/constants/theme';
import { LiquidBackground } from '@/components/ui/LiquidBackground';
import { AppSymbol } from '@/components/ui/AppSymbol';
import { useTabBarBottomInset } from '@/hooks/use-tab-bar-inset';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { usePairLocalStore } from '@/stores/pairLocalStore';
import { canDisplayAvatarUri } from '@/utils/avatarImage';
import { AvatarFullScreenModal } from '@/components/ui/AvatarFullScreenModal';

function daysUntilNextAnniversary(iso: string | null): number | null {
  if (!iso) return null;
  const ann = new Date(iso);
  if (Number.isNaN(ann.getTime())) return null;
  const now = new Date();
  const y = now.getFullYear();
  let next = new Date(y, ann.getMonth(), ann.getDate(), 12, 0, 0, 0);
  if (next.getTime() < now.getTime()) {
    next = new Date(y + 1, ann.getMonth(), ann.getDate(), 12, 0, 0, 0);
  }
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));
}

function moodAmbientHex(mood: string | null | undefined): string | undefined {
  if (!mood || !MoodIcons[mood]) return undefined;
  return `${MoodIcons[mood].color}33`;
}

type QuickAction = { key: string; label: string; sf: SFSymbol; ion: 'image' | 'mic' | 'location' | 'sparkles'; quick: string };

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'photo', label: 'Send Photo', sf: 'photo.on.rectangle.angled', ion: 'image', quick: 'photo' },
  { key: 'voice', label: 'Voice Note', sf: 'waveform', ion: 'mic', quick: 'voice' },
  { key: 'location', label: 'Location', sf: 'location.fill', ion: 'location', quick: 'location' },
  { key: 'memory', label: 'Memory', sf: 'sparkles', ion: 'sparkles', quick: 'memory' },
];

export default function UsDashboardScreen() {
  const router = useRouter();
  const { colors, scheme } = useThemeColors();
  const insets = useSafeAreaInsets();
  const tabBarBottom = useTabBarBottomInset();
  const { reduceMotion } = useAccessibilitySettings();

  const { partner, refreshPairStatus } = useAuthStore();
  const { partnerMood, isPartnerOnline } = useChatStore();
  const anniversaryIso = usePairLocalStore(s => s.anniversaryIso);

  const [refreshing, setRefreshing] = React.useState(false);
  const [partnerAvatarPreviewUri, setPartnerAvatarPreviewUri] = React.useState<string | null>(null);
  const fabScale = useSharedValue(1);
  const shimmer = useSharedValue(0);

  const daysLeft = daysUntilNextAnniversary(anniversaryIso);
  const showShimmer = daysLeft !== null && daysLeft <= 7 && !reduceMotion;

  useEffect(() => {
    if (!showShimmer) {
      cancelAnimation(shimmer);
      shimmer.value = 0;
      return;
    }
    shimmer.value = withRepeat(
      withSequence(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) })),
      -1
    );
    return () => cancelAnimation(shimmer);
  }, [showShimmer, reduceMotion]);

  const anniversaryShimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + shimmer.value * 0.45,
  }));

  const moodTint = moodAmbientHex(partnerMood);

  useFocusEffect(
    useCallback(() => {
      void useAuthStore.getState().refreshPairStatus();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshPairStatus();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setRefreshing(false);
    }
  }, [refreshPairStatus]);

  const openChat = useCallback(() => {
    fabScale.value = withSpring(0.92, { damping: 14, stiffness: 380 });
    setTimeout(() => {
      fabScale.value = withSpring(1, { damping: 12, stiffness: 320 });
    }, 120);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/chat' as Href);
  }, [fabScale, router]);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const moodInfo = partnerMood ? MoodIcons[partnerMood] : null;
  const tint: 'light' | 'dark' | 'default' = scheme === 'dark' ? 'dark' : 'light';

  return (
    <LiquidBackground variant={scheme} moodTint={moodTint}>
      <AvatarFullScreenModal
        uri={partnerAvatarPreviewUri}
        visible={!!partnerAvatarPreviewUri}
        onClose={() => setPartnerAvatarPreviewUri(null)}
        topInset={insets.top}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 12,
            /* Tab bar already sits below the scene; only reserve FAB + gesture inset */
            paddingBottom: (Platform.OS === 'android' ? 112 : 100) + Math.max(insets.bottom, 8),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
        }
      >
        <Text
          style={[Typography.largeTitle, { color: colors.text, marginBottom: 4, paddingHorizontal: 20 }]}
          accessibilityRole="header"
        >
          Us
        </Text>
        <Text style={[Typography.footnote, { color: colors.textMuted, marginBottom: 20, paddingHorizontal: 20 }]}>
          Together, at a glance
        </Text>

        {/* Partner avatar */}
        <View style={styles.avatarBlock}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={
              canDisplayAvatarUri(partner?.avatar)
                ? 'View partner profile photo'
                : 'Open chat with partner'
            }
            onPress={() => {
              if (canDisplayAvatarUri(partner?.avatar)) {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPartnerAvatarPreviewUri(partner!.avatar!);
              } else {
                openChat();
              }
            }}
            style={({ pressed }) => [pressed && { opacity: 0.92 }]}
          >
            <BlurView
              intensity={55}
              tint={tint}
              style={[
                styles.avatarLarge,
                {
                  borderColor: colors.glassBorder,
                  shadowColor: colors.accent,
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,131,96,0.25)', 'transparent']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              {canDisplayAvatarUri(partner?.avatar) ? (
                <Image
                  source={{ uri: partner!.avatar! }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 66 }]}
                  contentFit="cover"
                  transition={160}
                />
              ) : (
                <AppSymbol sf="person.fill" ion="person" size={56} color={colors.tint} />
              )}
            </BlurView>
            {isPartnerOnline && (
              <View style={[styles.onlineBadge, { backgroundColor: colors.online, borderColor: colors.background }]} />
            )}
          </Pressable>
          <Text style={[Typography.headline, { color: colors.text, marginTop: 12 }]}>
            {partner?.name ?? 'Partner'}
          </Text>
          <Text style={[Typography.caption1, { color: colors.textMuted, marginTop: 4 }]}>
            {isPartnerOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        {/* Mood pill */}
        <View style={styles.padH}>
          <BlurView intensity={50} tint={tint} style={[styles.moodPill, { borderColor: colors.glassBorder }]}>
            <AppSymbol sf="face.smiling" ion="happy-outline" size={18} color={colors.tint} />
            <Text style={[Typography.subhead, { color: colors.text, marginLeft: 8 }]}>
              {moodInfo && partnerMood
                ? `Partner: ${partnerMood.charAt(0).toUpperCase()}${partnerMood.slice(1)}`
                : 'Mood not shared yet'}
            </Text>
            {moodInfo && (
              <AppSymbol sf={moodInfo.sf as SFSymbol} ion={moodInfo.icon as never} size={18} color={moodInfo.color} style={{ marginLeft: 8 }} />
            )}
          </BlurView>
        </View>

        {/* Anniversary */}
        <View style={styles.padH}>
          <Animated.View style={[showShimmer ? anniversaryShimmerStyle : undefined]}>
            <BlurView intensity={48} tint={tint} style={[styles.anniversaryCard, { borderColor: colors.glassBorder }]}>
              <Text style={[Typography.caption1, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Anniversary
              </Text>
              {daysLeft !== null ? (
                <>
                  <Text
                    style={[styles.anniversaryNumber, { fontSize: 56, fontWeight: '700', color: colors.accent, marginTop: 8 }]}
                    accessibilityLabel={`${daysLeft} days until anniversary`}
                  >
                    {daysLeft}
                  </Text>
                  <Text style={[Typography.footnote, { color: colors.textMuted, marginTop: 4 }]}>days until your day</Text>
                </>
              ) : (
                <Text style={[Typography.body, { color: colors.textMuted, marginTop: 8 }]}>
                  Add your anniversary in settings to count down together.
                </Text>
              )}
            </BlurView>
          </Animated.View>
        </View>

        {/* Quick actions */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quick actions</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/chat',
                  params: { quick: a.quick },
                } as unknown as Href);
              }}
              style={({ pressed }) => [styles.quickCell, pressed && { opacity: 0.9 }]}
            >
              <BlurView intensity={45} tint={tint} style={[styles.quickInner, { borderColor: colors.glassBorder }]}>
                <AppSymbol sf={a.sf} ion={a.ion} size={26} color={colors.tint} />
                <Text style={[Typography.caption1, { color: colors.text, marginTop: 8, textAlign: 'center' }]} numberOfLines={2}>
                  {a.label}
                </Text>
              </BlurView>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Chat FAB */}
      <View
        pointerEvents="box-none"
        style={[
          styles.fabWrap,
          {
            // Sit just above the tab bar (large `bottom` pushes the FAB too high and over quick actions)
            bottom: tabBarBottom + 8,
          },
        ]}
      >
        <Animated.View style={fabStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open chat"
            onPress={openChat}
            style={({ pressed }) => [styles.fabOuter, { opacity: pressed ? 0.95 : 1 }]}
          >
            <BlurView intensity={70} tint={tint} style={[styles.fabBlur, { borderColor: colors.accent + '99' }]}>
              <LinearGradient
                colors={['rgba(255,131,96,0.55)', 'rgba(255,107,107,0.35)']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <AppSymbol
                sf="bubble.left.and.bubble.right.fill"
                ion="chatbubbles"
                size={28}
                color={scheme === 'light' ? colors.text : '#FFFFFF'}
              />
            </BlurView>
          </Pressable>
        </Animated.View>
      </View>
    </LiquidBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  padH: { paddingHorizontal: 20, marginBottom: 16 },
  avatarBlock: { alignItems: 'center', marginBottom: 24 },
  avatarLarge: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  onlineBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  anniversaryCard: {
    borderRadius: BorderRadius.xl,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    minHeight: 120,
  },
  anniversaryNumber: {
    fontVariant: ['tabular-nums'],
  },
  sectionLabel: {
    ...Typography.caption1,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 24,
    marginBottom: 10,
    marginTop: 8,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    justifyContent: 'space-between',
  },
  quickCell: {
    width: '47%',
    minHeight: 100,
  },
  quickInner: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
    minHeight: 100,
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
  },
  fabOuter: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  fabBlur: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
});
