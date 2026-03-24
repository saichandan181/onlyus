import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { GlassButton } from '@/components/ui/GlassButton';
import { useAuthStore } from '@/stores/authStore';
import * as Haptics from 'expo-haptics';

export default function RegisterScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { register } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(onboarding)/welcome');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            entering={FadeInUp.delay(200).springify()}
            style={styles.logoArea}
          >
            <View style={[styles.logoCircle, { backgroundColor: colors.tint }]}>
              <Ionicons name="people" size={36} color="#FFF" />
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>
              Join Only Us
            </Text>
            <Text style={[styles.tagline, { color: colors.textMuted }]}>
              Create your private sanctuary
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <GlassCard style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Create Account
              </Text>

              <GlassInput
                label="Your Name"
                icon="person-outline"
                placeholder="How should we call you?"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <GlassInput
                label="Email"
                icon="mail-outline"
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <GlassInput
                label="Password"
                icon="lock-closed-outline"
                placeholder="Create a strong password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <GlassInput
                label="Confirm Password"
                icon="shield-checkmark-outline"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: colors.error + '15' }]}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <GlassButton
                title="Create Account"
                icon="sparkles"
                iconPosition="right"
                loading={loading}
                onPress={handleRegister}
                fullWidth
                size="lg"
              />

              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                <Text style={[styles.securityText, { color: colors.textMuted }]}>
                  End-to-end encrypted • Your data stays private
                </Text>
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(600).springify()}
            style={styles.loginLink}
          >
            <Text style={[styles.linkText, { color: colors.textMuted }]}>
              Already have an account?{' '}
            </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={[styles.linkAction, { color: colors.tint }]}>
                Sign In
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: {
    ...Typography.title1,
    letterSpacing: 0.5,
  },
  tagline: {
    ...Typography.subhead,
    marginTop: 4,
  },
  card: {
    marginBottom: 24,
  },
  cardTitle: {
    ...Typography.title3,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    ...Typography.footnote,
    flex: 1,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  securityText: {
    ...Typography.caption1,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    ...Typography.callout,
  },
  linkAction: {
    ...Typography.callout,
    fontWeight: '600',
  },
});
