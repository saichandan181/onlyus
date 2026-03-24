import React, { useState } from 'react';
import { TextInput, View, StyleSheet, TextInputProps, Text } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, BorderRadius, Typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface GlassInputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

export function GlassInput({
  label,
  icon,
  error,
  style,
  onFocus,
  onBlur,
  ...props
}: GlassInputProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      )}
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.inputBg,
            borderColor: isFocused
              ? colors.tint
              : error
              ? colors.error
              : colors.inputBorder,
            borderWidth: isFocused ? 1.5 : 0.5,
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? colors.tint : colors.iconMuted}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            { color: colors.text },
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    ...Typography.caption1,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 14,
  },
  error: {
    ...Typography.caption1,
    marginTop: 4,
    marginLeft: 4,
  },
});
