import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  PressableProps,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, BorderRadius, Typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GlassButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function GlassButton({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
  style,
  ...props
}: GlassButtonProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getBackgroundColor = () => {
    if (disabled) return colors.glassLight;
    switch (variant) {
      case 'primary':
        return colors.tint;
      case 'secondary':
        return colors.glass;
      case 'ghost':
        return 'transparent';
      case 'danger':
        return colors.error;
      default:
        return colors.tint;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
      case 'ghost':
        return colors.text;
      default:
        return '#FFFFFF';
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return { paddingHorizontal: 16, paddingVertical: 8, minHeight: 36 };
      case 'md':
        return { paddingHorizontal: 24, paddingVertical: 14, minHeight: 50 };
      case 'lg':
        return { paddingHorizontal: 32, paddingVertical: 18, minHeight: 58 };
    }
  };

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  return (
    <AnimatedPressable
      style={[
        styles.button,
        getSizeStyle(),
        {
          backgroundColor: getBackgroundColor(),
          borderColor:
            variant === 'secondary' ? colors.glassBorder : 'transparent',
          borderWidth: variant === 'secondary' ? 0.5 : 0,
          width: fullWidth ? '100%' : undefined,
        },
        animatedStyle,
        style as ViewStyle,
      ]}
      disabled={disabled || loading}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={getTextColor()}
              style={styles.iconLeft}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 16,
              },
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={getTextColor()}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
