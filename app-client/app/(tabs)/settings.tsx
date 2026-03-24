import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { SFSymbol } from 'sf-symbols-typescript';
import { AppSymbol } from '@/components/ui/AppSymbol';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  Typography,
  BorderRadius,
  MoodIcons,
  THEME_PALETTE_META,
  getPaletteColors,
  type ThemePaletteId,
} from '@/constants/theme';
import { useThemeSettingsStore, type AppearanceMode } from '@/stores/themeSettingsStore';
import { IOS_PHOTO_LIBRARY_OPTIONS } from '@/constants/imagePicker';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { usePairLocalStore } from '@/stores/pairLocalStore';
import { api } from '@/services/api';
import { getFingerprint } from '@/services/encryption';
import { clearAllMessages } from '@/services/database';
import { useSocket } from '@/hooks/useSocket';
import { encryptMood } from '@/services/pairCrypto';
import { ensureSharedSecret } from '@/services/sharedSecret';
import { canDisplayAvatarUri, imageAssetToDataUri } from '@/utils/avatarImage';
import { AvatarFullScreenModal } from '@/components/ui/AvatarFullScreenModal';
import { disconnectSharedSocket, getActiveSocket } from '@/services/socketClient';
import { clearIncomingMediaBuffers } from '@/services/mediaIncomingBuffer';

const THEME_IDS = Object.keys(THEME_PALETTE_META) as ThemePaletteId[];

export default function SettingsScreen() {
  const { colors, scheme } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const appearance = useThemeSettingsStore((s) => s.appearance);
  const paletteId = useThemeSettingsStore((s) => s.paletteId);
  const setAppearance = useThemeSettingsStore((s) => s.setAppearance);
  const setPaletteId = useThemeSettingsStore((s) => s.setPaletteId);
  const { user, partner, token, logout, refreshUser, refreshPairStatus, sharedSecret, isPaired } =
    useAuthStore();
  const { updateMoodEncrypted } = useSocket(token);
  const myMoodKey = usePairLocalStore(s => s.myMoodKey);
  const pairLocalHydrated = usePairLocalStore(s => s.hydrated);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [unpairing, setUnpairing] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    if (!pairLocalHydrated) return;
    setSelectedMood(myMoodKey);
  }, [pairLocalHydrated, myMoodKey]);

  useFocusEffect(
    useCallback(() => {
      void useAuthStore.getState().refreshPairStatus();
    }, [])
  );

  const handleAvatarPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Allow photo library access to change your avatar.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.55,
        ...IOS_PHOTO_LIBRARY_OPTIONS,
      });

      if (!result.canceled && result.assets[0]) {
        try {
          const asset = result.assets[0];
          const dataUri = await imageAssetToDataUri({
            uri: asset.uri,
            mimeType: asset.mimeType,
          });
          await api.updateProfile({ avatar: dataUri });
          await refreshUser();
          await refreshPairStatus();
          getActiveSocket()?.emit('profile:updated', {});
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: unknown) {
          console.error('Failed to update avatar:', err);
          const code = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : '';
          if (code === 'IMAGE_TOO_LARGE') {
            Alert.alert('Avatar', 'That image is too large. Try a smaller photo.');
          } else {
            Alert.alert('Avatar', 'Could not upload. Check your connection and try again.');
          }
        }
      }
    } catch (e) {
      console.warn('[avatar pick]', e);
      Alert.alert('Photos', 'Could not open the photo library. Try again.');
    }
  };

  const handleMoodSelect = async (mood: string) => {
    setSelectedMood(mood);
    if (!isPaired) {
      Alert.alert('Pair first', 'Pair with your partner to share your mood securely.');
      return;
    }
    try {
      const secret = sharedSecret ?? (await ensureSharedSecret());
      if (!secret) {
        Alert.alert(
          'Encryption not ready',
          'Could not derive a shared secret. Ensure both devices have completed pairing with encryption keys.'
        );
        return;
      }
      const enc = await encryptMood(mood, secret);
      updateMoodEncrypted(enc);
      await usePairLocalStore.getState().setMyMoodKey(mood);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Failed to sync mood:', err);
    }
  };

  const handleUnpair = () => {
    Alert.alert(
      'Unpair',
      'This will permanently disconnect you from your partner and delete all shared data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            setUnpairing(true);
            try {
              await api.unpair();
              await clearAllMessages();
              clearIncomingMediaBuffers();
              disconnectSharedSocket();
              useChatStore.getState().clearMessages();
              useChatStore.getState().setPartnerMood(null);
              useChatStore.getState().setTyping(false);
              await usePairLocalStore.getState().clear();
              await useAuthStore.getState().refreshPairStatus();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (err) {
              console.error('Failed to unpair:', err);
            } finally {
              setUnpairing(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const fingerprint = user?.public_key ? getFingerprint(user.public_key) : 'Not available';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AvatarFullScreenModal
        uri={avatarPreviewUri}
        visible={!!avatarPreviewUri}
        onClose={() => setAvatarPreviewUri(null)}
        topInset={insets.top}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 12) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        {/* Profile Section */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <GlassCard style={styles.card}>
            <View style={styles.profileSection}>
              <View style={styles.avatarButton}>
                <Pressable
                  onPress={() => {
                    if (canDisplayAvatarUri(user?.avatar)) {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setAvatarPreviewUri(user!.avatar!);
                    } else {
                      handleAvatarPick();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    canDisplayAvatarUri(user?.avatar) ? 'View profile photo full screen' : 'Add profile photo'
                  }
                >
                  <View style={[styles.avatar, { backgroundColor: colors.tint + '20', overflow: 'hidden' }]}>
                    {canDisplayAvatarUri(user?.avatar) ? (
                      <Image
                        source={{ uri: user!.avatar! }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                        transition={120}
                      />
                    ) : (
                      <AppSymbol sf="person.fill" ion="person" size={32} color={colors.tint} />
                    )}
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.avatarBadge, { backgroundColor: colors.tint }]}
                  onPress={handleAvatarPick}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                >
                  <Ionicons name="camera" size={12} color="#FFF" />
                </Pressable>
              </View>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {user?.name || 'You'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
                {user?.email || ''}
              </Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Mood Section */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            Your Mood
          </Text>
          {!isPaired && (
            <Text style={[styles.moodHint, { color: colors.textMuted }]}>
              Pair with your partner to share your mood end-to-end.
            </Text>
          )}
          <GlassCard style={styles.card}>
            <View style={styles.moodGrid}>
              {Object.entries(MoodIcons).map(([mood, info]) => (
                <Pressable
                  key={mood}
                  onPress={() => handleMoodSelect(mood)}
                  style={[
                    styles.moodItem,
                    selectedMood === mood && {
                      backgroundColor: info.color + '20',
                      borderColor: info.color,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <AppSymbol sf={info.sf as SFSymbol} ion={info.icon as never} size={22} color={info.color} />
                  <Text
                    style={[
                      styles.moodLabel,
                      { color: selectedMood === mood ? info.color : colors.textMuted },
                    ]}
                  >
                    {mood}
                  </Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        </Animated.View>

        {/* Partner Section */}
        {partner && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              Your Partner
            </Text>
            <GlassCard style={styles.card}>
              <View style={styles.partnerRow}>
                <View style={[styles.partnerAvatar, { backgroundColor: colors.accent + '20' }]}>
                  <AppSymbol sf="heart.fill" ion="heart" size={20} color={colors.accent} />
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={[styles.partnerName, { color: colors.text }]}>
                    {partner.name}
                  </Text>
                  <View style={styles.partnerStatus}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: partner.is_online ? colors.online : colors.textMuted },
                      ]}
                    />
                    <Text style={[styles.statusLabel, { color: colors.textMuted }]}>
                      {partner.is_online ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* Security Section */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            Security
          </Text>
          <GlassCard style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="finger-print" size={22} color={colors.tint} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Encryption Fingerprint
                  </Text>
                  <Text style={[styles.fingerprintText, { color: colors.textMuted }]}>
                    {fingerprint}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="shield-checkmark" size={22} color={colors.success} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  End-to-End Encrypted
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Appearance & theme — below Security */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Appearance</Text>
          <GlassCard style={styles.card}>
            <Text style={[styles.themeSubLabel, { color: colors.textMuted }]}>Brightness</Text>
            <View style={styles.appearanceRow}>
              {(
                [
                  { key: 'system' as const, label: 'System' },
                  { key: 'light' as const, label: 'Light' },
                  { key: 'dark' as const, label: 'Dark' },
                ] satisfies { key: AppearanceMode; label: string }[]
              ).map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setAppearance(opt.key);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.appearanceChip,
                    {
                      borderColor: appearance === opt.key ? colors.tint : colors.glassBorder,
                      backgroundColor:
                        appearance === opt.key ? colors.tint + '22' : colors.backgroundSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.appearanceChipText,
                      { color: appearance === opt.key ? colors.tint : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.divider, marginVertical: 12 }]} />
            <Text style={[styles.themeSubLabel, { color: colors.textMuted }]}>Color theme</Text>
            <Text style={[styles.themeHint, { color: colors.textMuted }]}>
              Chat and accent colors for this device.
            </Text>
            <View style={styles.themeGrid}>
              {THEME_IDS.map((id) => {
                const meta = THEME_PALETTE_META[id];
                const preview = getPaletteColors(id, scheme);
                const selected = paletteId === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      setPaletteId(id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    style={[
                      styles.themeOption,
                      {
                        borderColor: selected ? colors.tint : colors.glassBorder,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    <View style={styles.themeSwatches}>
                      <View style={[styles.swatch, { backgroundColor: preview.background }]} />
                      <View style={[styles.swatch, { backgroundColor: preview.tint }]} />
                      <View style={[styles.swatch, { backgroundColor: preview.myBubble }]} />
                    </View>
                    <Text style={[styles.themeOptionName, { color: colors.text }]}>{meta.label}</Text>
                    <Text style={[styles.themeOptionDesc, { color: colors.textMuted }]} numberOfLines={2}>
                      {meta.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(550).springify()}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            Account
          </Text>
          <View style={styles.dangerZone}>
            {partner && (
              <GlassButton
                title="Unpair"
                icon="heart-dislike"
                variant="danger"
                onPress={handleUnpair}
                loading={unpairing}
                fullWidth
              />
            )}
            <GlassButton
              title="Logout"
              icon="log-out-outline"
              variant="secondary"
              onPress={handleLogout}
              fullWidth
            />
          </View>
        </Animated.View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: colors.textMuted }]}>
            Only Us v1.0.0
          </Text>
          <Text style={[styles.appInfoText, { color: colors.textMuted }]}>
            Made with love, for two
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    ...Typography.largeTitle,
    marginBottom: 20,
  },
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  moodHint: {
    ...Typography.caption1,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: -4,
  },
  card: {
    marginBottom: 12,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  avatarButton: {
    position: 'relative',
    marginBottom: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileName: {
    ...Typography.title3,
  },
  profileEmail: {
    ...Typography.footnote,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    gap: 4,
    minWidth: 70,
  },
  moodLabel: {
    ...Typography.caption2,
    textTransform: 'capitalize',
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInfo: {
    flex: 1,
    gap: 4,
  },
  partnerName: {
    ...Typography.headline,
  },
  partnerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    ...Typography.caption1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    ...Typography.body,
  },
  fingerprintText: {
    ...Typography.caption1,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  divider: {
    height: 0.5,
    marginVertical: 8,
  },
  dangerZone: {
    gap: 10,
    marginBottom: 20,
  },
  appInfo: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
  },
  appInfoText: {
    ...Typography.caption1,
  },
  themeSubLabel: {
    ...Typography.subhead,
    fontWeight: '600',
    marginBottom: 8,
  },
  themeHint: {
    ...Typography.caption1,
    marginBottom: 12,
  },
  appearanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  appearanceChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  appearanceChipText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  themeGrid: {
    gap: 10,
  },
  themeOption: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 12,
  },
  themeSwatches: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  swatch: {
    width: 36,
    height: 22,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  themeOptionName: {
    ...Typography.headline,
    fontSize: 16,
  },
  themeOptionDesc: {
    ...Typography.caption1,
    marginTop: 4,
  },
});
