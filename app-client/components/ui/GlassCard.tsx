import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { BorderRadius } from '@/constants/theme';

interface GlassCardProps extends ViewProps {
  intensity?: number;
  borderRadius?: number;
  padding?: number;
  noPadding?: boolean;
}

export function GlassCard({
  children,
  style,
  intensity = 40,
  borderRadius = BorderRadius.lg,
  padding = 16,
  noPadding = false,
  ...props
}: GlassCardProps) {
  const { colors } = useThemeColors();

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          borderColor: colors.glassBorder,
          backgroundColor: colors.glass,
          shadowColor: colors.shadow,
        },
        style,
      ]}
      {...props}
    >
      <View
        style={[
          styles.content,
          {
            borderRadius,
            padding: noPadding ? 0 : padding,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 0.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  // Do not use flex:1 here — without a bounded parent height it collapses to ~0 on iOS.
  content: {
    alignSelf: 'stretch',
  },
});
