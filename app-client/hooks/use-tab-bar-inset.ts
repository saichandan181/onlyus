import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height to reserve for tab bar + home indicator.
 *
 * On Android with the JS `Tabs` navigator (`expo-router` + `@react-navigation/bottom-tabs`),
 * we read the real tab bar height from context so FABs and scroll padding match Material tabs.
 *
 * On iOS we use `NativeTabs` (no Bottom Tab context), so we approximate.
 */
export function useTabBarBottomInset(): number {
  const insets = useSafeAreaInsets();
  const tabBarFromNavigator = useContext(BottomTabBarHeightContext);

  if (tabBarFromNavigator !== undefined) {
    return tabBarFromNavigator;
  }

  const tabBar = Platform.select({ ios: 49, android: 80, default: 56 }) ?? 56;
  return tabBar + insets.bottom;
}
