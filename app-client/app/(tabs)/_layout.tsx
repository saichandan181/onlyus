import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform } from 'react-native';

// iOS 26+: transparent system tab bar; older iOS: chrome material blur (Expo-Glass-Template)
const isIOS26OrHigher = Platform.OS === 'ios' && Number(Platform.Version) >= 26;

/**
 * NativeTabs.Trigger only accepts direct children whose type is Icon | Label | TabBar
 * (see filterAllowedChildrenElements). Wrapping <Icon /> in another component breaks icons.
 */

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'light';
  const c = Colors[scheme];

  const tabBarBackground = isIOS26OrHigher
    ? 'transparent'
    : scheme === 'dark'
      ? Colors.dark.background
      : Colors.light.background;

  const tabBarBlur = isIOS26OrHigher
    ? 'none'
    : scheme === 'dark'
      ? 'systemChromeMaterialDark'
      : 'systemChromeMaterialLight';

  const tabBarProps = {
    backgroundColor: tabBarBackground,
    blurEffect: tabBarBlur,
    disableTransparentOnScrollEdge: !isIOS26OrHigher,
  } as const;

  return (
    <NativeTabs
      iconColor={c.tabIconSelected}
      tintColor={c.tint}
      badgeTextColor={c.text}
      backgroundColor={tabBarBackground}
      blurEffect={tabBarBlur}
      minimizeBehavior="automatic"
      disableTransparentOnScrollEdge={!isIOS26OrHigher}
    >
      <NativeTabs.Trigger name="us">
        {Platform.OS === 'ios' ? (
          <Icon
            sf={
              {
                default: 'heart.circle',
                selected: 'heart.circle.fill',
              } as never
            }
          />
        ) : (
          <Icon src={<VectorIcon family={Ionicons} name="heart-circle-outline" />} />
        )}
        <Label>Us</Label>
        <NativeTabs.Trigger.TabBar {...tabBarProps} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="moments">
        {Platform.OS === 'ios' ? (
          <Icon
            sf={
              {
                default: 'photo.on.rectangle',
                selected: 'photo.on.rectangle.fill',
              } as never
            }
          />
        ) : (
          <Icon src={<VectorIcon family={Ionicons} name="images" />} />
        )}
        <Label>Moments</Label>
        <NativeTabs.Trigger.TabBar {...tabBarProps} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        {Platform.OS === 'ios' ? (
          <Icon
            sf={
              {
                default: 'calendar',
                selected: 'calendar.circle.fill',
              } as never
            }
          />
        ) : (
          <Icon src={<VectorIcon family={Ionicons} name="calendar" />} />
        )}
        <Label>Calendar</Label>
        <NativeTabs.Trigger.TabBar {...tabBarProps} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        {Platform.OS === 'ios' ? (
          <Icon
            sf={
              {
                default: 'gearshape',
                selected: 'gearshape.fill',
              } as never
            }
          />
        ) : (
          <Icon src={<VectorIcon family={Ionicons} name="settings" />} />
        )}
        <Label>Settings</Label>
        <NativeTabs.Trigger.TabBar {...tabBarProps} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
