import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * NativeTabs (`expo-router/unstable-native-tabs`) are not the JS BottomTabNavigator,
 * so `useBottomTabBarHeight()` from @react-navigation/bottom-tabs throws — no matching context.
 *
 * Approximate the space needed so content clears the system tab bar + home indicator.
 */
export function useTabBarBottomInset(): number {
  const insets = useSafeAreaInsets();
  const tabBar = Platform.select({ ios: 49, android: 56, default: 56 }) ?? 56;
  return tabBar + insets.bottom;
}
