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
import { useRouter, type Href } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { Typography, Spacing } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { GlassButton } from '@/components/ui/GlassButton';
import { useAuthStore } from '@/stores/authStore';

export default function LoginScreen() {
  const { colors } = useThemeColors();
  const router = useRouter();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      console.log('Attempting login with:', email);
      await login(email.trim(), password);
      console.log('Login successful');
      const { isPaired } = useAuthStore.getState();
      router.replace((isPaired ? '/(tabs)/us' : '/(onboarding)/pairing') as Href);
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.message || err.detail || 'Invalid credentials';
      setError(errorMessage);
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
          {/* Logo Area */}
          <Animated.View
            entering={FadeInUp.delay(200).springify()}
            style={styles.logoArea}
          >
            <View style={[styles.logoCircle, { backgroundColor: colors.tint }]}>
              <Ionicons name="heart" size={40} color="#FFF" />
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>
              Only Us
            </Text>
            <Text style={[styles.tagline, { color: colors.textMuted }]}>
              A private space for two
            </Text>
          </Animated.View>

          {/* Login Card */}
          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <GlassCard style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Welcome Back
              </Text>

              <GlassInput
                label="Email"
                icon="mail-outline"
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View>
                <GlassInput
                  label="Password"
                  icon="lock-closed-outline"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.iconMuted}
                  />
                </Pressable>
              </View>

              {error ? (
                <Animated.View entering={FadeInDown.springify()}>
                  <View style={[styles.errorBox, { backgroundColor: colors.error + '15' }]}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={[styles.errorText, { color: colors.error }]}>
                      {error}
                    </Text>
                  </View>
                </Animated.View>
              ) : null}

              <GlassButton
                title="Sign In"
                icon="arrow-forward"
                iconPosition="right"
                loading={loading}
                onPress={handleLogin}
                fullWidth
                size="lg"
              />
            </GlassCard>
          </Animated.View>

          {/* Register Link */}
          <Animated.View
            entering={FadeInDown.delay(600).springify()}
            style={styles.registerLink}
          >
            <Text style={[styles.registerText, { color: colors.textMuted }]}>
              Don't have an account?{' '}
            </Text>
            <Pressable onPress={() => router.push('/(auth)/register')}>
              <Text style={[styles.registerAction, { color: colors.tint }]}>
                Create One
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
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    ...Typography.largeTitle,
    letterSpacing: 1,
  },
  tagline: {
    ...Typography.subhead,
    marginTop: 4,
    fontStyle: 'italic',
  },
  card: {
    marginBottom: 24,
  },
  cardTitle: {
    ...Typography.title2,
    marginBottom: 24,
    textAlign: 'center',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 38,
    padding: 4,
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
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    ...Typography.callout,
  },
  registerAction: {
    ...Typography.callout,
    fontWeight: '600',
  },
});
