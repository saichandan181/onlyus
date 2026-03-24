import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography, BorderRadius } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'generate' | 'join';

export default function PairingScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const refreshPairStatus = useAuthStore((s) => s.refreshPairStatus);
  const isPaired = useAuthStore((s) => s.isPaired);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);

  // Code generator: partner joining does not notify this device — poll until pair is active.
  useFocusEffect(
    useCallback(() => {
      if (isPaired || !generatedCode) return;
      const id = setInterval(() => {
        refreshPairStatus();
      }, 2500);
      return () => clearInterval(id);
    }, [isPaired, refreshPairStatus, generatedCode]),
  );

  // When server reports paired (joiner after join, or generator after poll), go to chat.
  useEffect(() => {
    if (!isPaired) return;
    router.replace('/(tabs)/us' as Href);
  }, [isPaired, router]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        setGeneratedCode(null);
        setExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.generatePairingCode();
      setGeneratedCode(result.code);
      setExpiresAt(new Date(result.expires_at));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err: any) {
      setError(err.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const fullCode = codeDigits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.joinPair(fullCode);
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshPairStatus();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...codeDigits];
    newDigits[index] = value;
    setCodeDigits(newDigits);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successContainer}>
          <Animated.View entering={ZoomIn.springify()}>
            <View style={[styles.successCircle, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="heart" size={64} color={colors.tint} />
            </View>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(300).springify()}>
            <Text style={[styles.successTitle, { color: colors.text }]}>
              Connected!
            </Text>
            <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
              Your private space is ready
            </Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View entering={FadeInUp.springify()} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Connect with your person
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Share a code to create your private space
          </Text>
        </Animated.View>

        {/* Tab Switcher */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <GlassCard style={styles.tabBar} padding={4}>
            <View style={styles.tabRow}>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === 'generate' && [styles.activeTab, { backgroundColor: colors.tint }],
                ]}
                onPress={() => { setActiveTab('generate'); setError(''); }}
              >
                <Ionicons
                  name="key-outline"
                  size={18}
                  color={activeTab === 'generate' ? '#FFF' : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'generate' ? '#FFF' : colors.textMuted },
                  ]}
                >
                  Generate
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === 'join' && [styles.activeTab, { backgroundColor: colors.tint }],
                ]}
                onPress={() => { setActiveTab('join'); setError(''); }}
              >
                <Ionicons
                  name="enter-outline"
                  size={18}
                  color={activeTab === 'join' ? '#FFF' : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'join' ? '#FFF' : colors.textMuted },
                  ]}
                >
                  Join
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Content */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          {activeTab === 'generate' ? (
            <GlassCard style={styles.contentCard}>
              {generatedCode ? (
                <View style={styles.codeDisplay}>
                  <Text style={[styles.codeLabel, { color: colors.textMuted }]}>
                    Your pairing code
                  </Text>
                  <Text style={[styles.codeText, { color: colors.text }]}>
                    {generatedCode.split('').join(' ')}
                  </Text>
                  <View style={[styles.timerBadge, { backgroundColor: colors.tint + '20' }]}>
                    <Ionicons name="time-outline" size={16} color={colors.tint} />
                    <Text style={[styles.timerText, { color: colors.tint }]}>
                      {formatTime(remainingSeconds)}
                    </Text>
                  </View>
                  <Text style={[styles.codeHint, { color: colors.textMuted }]}>
                    Share this code with your partner
                  </Text>
                  <GlassButton
                    title="Generate New Code"
                    variant="secondary"
                    icon="refresh"
                    onPress={handleGenerate}
                    loading={loading}
                    fullWidth
                  />
                </View>
              ) : (
                <View style={styles.generateEmpty}>
                  <View style={[styles.keyCircle, { backgroundColor: colors.tint + '15' }]}>
                    <Ionicons name="key" size={40} color={colors.tint} />
                  </View>
                  <Text style={[styles.generateHint, { color: colors.textMuted }]}>
                    Generate a unique code for your partner to enter
                  </Text>
                  <GlassButton
                    title="Generate Code"
                    icon="sparkles"
                    onPress={handleGenerate}
                    loading={loading}
                    fullWidth
                    size="lg"
                  />
                </View>
              )}
            </GlassCard>
          ) : (
            <GlassCard style={styles.contentCard}>
              <Text style={[styles.joinLabel, { color: colors.textMuted }]}>
                Enter your partner's code
              </Text>
              <View style={styles.digitRow}>
                {codeDigits.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.digitInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: digit ? colors.tint : colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                    value={digit}
                    onChangeText={(v) => handleDigitChange(index, v)}
                    onKeyPress={(e) => handleKeyPress(index, e.nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>
              <GlassButton
                title="Connect"
                icon="heart"
                onPress={handleJoin}
                loading={loading}
                disabled={codeDigits.some(d => !d)}
                fullWidth
                size="lg"
              />
            </GlassCard>
          )}
        </Animated.View>

        {error ? (
          <Animated.View entering={FadeIn.springify()}>
            <View style={[styles.errorBox, { backgroundColor: colors.error + '15' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    ...Typography.title2,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.subhead,
    textAlign: 'center',
    marginTop: 6,
  },
  tabBar: {
    marginBottom: 20,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 52,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    ...Typography.headline,
  },
  contentCard: {
    marginBottom: 16,
  },
  codeDisplay: {
    alignItems: 'center',
    gap: 12,
  },
  codeLabel: {
    ...Typography.caption1,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeText: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 8,
    fontFamily: 'monospace',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  timerText: {
    ...Typography.headline,
    fontFamily: 'monospace',
  },
  codeHint: {
    ...Typography.footnote,
    textAlign: 'center',
  },
  generateEmpty: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  keyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateHint: {
    ...Typography.callout,
    textAlign: 'center',
  },
  joinLabel: {
    ...Typography.caption1,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 16,
  },
  digitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  digitInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    fontSize: 24,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    ...Typography.footnote,
    flex: 1,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    ...Typography.largeTitle,
    textAlign: 'center',
  },
  successSubtitle: {
    ...Typography.callout,
    textAlign: 'center',
    marginTop: 4,
  },
});
