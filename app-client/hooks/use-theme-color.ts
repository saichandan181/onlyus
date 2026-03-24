/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { getPaletteColors, type AppThemeColors } from '@/constants/theme';
import { useThemeSettingsStore } from '@/stores/themeSettingsStore';
import { useResolvedColorScheme } from '@/hooks/use-theme-colors';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof AppThemeColors
) {
  const scheme = useResolvedColorScheme();
  const paletteId = useThemeSettingsStore((s) => s.paletteId);
  const colors = getPaletteColors(paletteId, scheme);
  const colorFromProps = props[scheme];

  if (colorFromProps) {
    return colorFromProps;
  }
  return colors[colorName] as string;
}

