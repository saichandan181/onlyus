import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { SafeAreaView } from 'react-native-safe-area-context';

const features = [
  {
    icon: 'shield-checkmark' as const,
    title: 'End-to-End Encrypted',
    desc: 'Your conversations stay between you two. Always.',
  },
  {
    icon: 'heart' as const,
    title: 'Made for Couples',
    desc: 'Share moments, moods, and memories in one intimate space.',
  },
  {
    icon: 'sparkles' as const,
    title: 'Beautifully Crafted',
    desc: 'Every detail designed with love and care.',
  },
];

export default function WelcomeScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Animated Logo */}
        <Animated.View
          entering={ZoomIn.delay(300).springify()}
          style={styles.logoArea}
        >
          <View style={[styles.logoCircle, { backgroundColor: colors.tint }]}>
            <Ionicons name="heart" size={48} color="#FFF" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).springify()}>
          <Text style={[styles.title, { color: colors.text }]}>
            Only Us
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Your private sanctuary for two
          </Text>
        </Animated.View>

        {/* Feature Cards */}
        <View style={styles.features}>
          {features.map((feature, index) => (
            <Animated.View
              key={feature.title}
              entering={FadeInDown.delay(700 + index * 150).springify()}
            >
              <GlassCard style={styles.featureCard} padding={14}>
                <View style={styles.featureRow}>
                  <View
                    style={[
                      styles.featureIcon,
                      { backgroundColor: colors.tint + '20' },
                    ]}
                  >
                    <Ionicons
                      name={feature.icon}
                      size={22}
                      color={colors.tint}
                    />
                  </View>
                  <View style={styles.featureText}>
                    <Text
                      style={[styles.featureTitle, { color: colors.text }]}
                    >
                      {feature.title}
                    </Text>
                    <Text
                      style={[styles.featureDesc, { color: colors.textMuted }]}
                    >
                      {feature.desc}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          ))}
        </View>

        {/* Action Button */}
        <Animated.View
          entering={FadeInDown.delay(1200).springify()}
          style={styles.actionArea}
        >
          <GlassButton
            title="Get Started"
            icon="arrow-forward"
            iconPosition="right"
            size="lg"
            fullWidth
            onPress={() => router.push('/(onboarding)/pairing')}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    ...Typography.largeTitle,
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    ...Typography.callout,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
    marginBottom: 32,
  },
  features: {
    gap: 10,
    marginBottom: 32,
  },
  featureCard: {
    marginBottom: 0,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...Typography.headline,
    marginBottom: 2,
  },
  featureDesc: {
    ...Typography.caption1,
  },
  actionArea: {
    paddingHorizontal: 8,
  },
});
