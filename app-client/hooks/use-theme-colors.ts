import { useCallback, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { useThemeSettingsStore } from '@/stores/themeSettingsStore';
import { getPaletteColors, type ThemePaletteId } from '@/constants/theme';

/**
 * System light/dark without `useColorScheme` from react-native — avoids Hermes
 * "Property 'useColorScheme' doesn't exist" in some RN/Expo bundles.
 */
function useSystemColorScheme(): 'light' | 'dark' {
  const subscribe = useCallback((onChange: () => void) => {
    const sub = Appearance.addChangeListener(() => onChange());
    return () => sub.remove();
  }, []);
  const getSnapshot = useCallback(
    () => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'),
    []
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light');
}

export function useResolvedColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme();
  const appearance = useThemeSettingsStore((s) => s.appearance);
  if (appearance === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return appearance;
}

export function useThemeColors(): {
  colors: ReturnType<typeof getPaletteColors>;
  scheme: 'light' | 'dark';
  paletteId: ThemePaletteId;
} {
  const scheme = useResolvedColorScheme();
  const paletteId = useThemeSettingsStore((s) => s.paletteId);
  const colors = getPaletteColors(paletteId, scheme);
  return { colors, scheme, paletteId };
}
