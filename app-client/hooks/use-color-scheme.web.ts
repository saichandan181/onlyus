import { useCallback, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

/**
 * Web: same Appearance subscription as native (no react-native `useColorScheme`).
 */
export function useColorScheme() {
  const subscribe = useCallback((onChange: () => void) => {
    const sub = Appearance.addChangeListener(() => onChange());
    return () => sub.remove();
  }, []);
  const getSnapshot = useCallback(
    () => Appearance.getColorScheme() ?? 'light',
    []
  );
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => 'light' as const
  );
}

export { useResolvedColorScheme, useThemeColors } from './use-theme-colors';

