import { useThemeColors } from '@/hooks/use-theme-colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

// iOS 26+: transparent system tab bar; older iOS: chrome material blur (Expo-Glass-Template)
const isIOS26OrHigher = Platform.OS === 'ios' && Number(Platform.Version) >= 26;

/**
 * NativeTabs.Trigger only accepts direct children whose type is Icon | Label | TabBar
 * (see filterAllowedChildrenElements). Wrapping <Icon /> in another component breaks icons.
 */

/** Material Design–style bottom navigation for Android (stable height, proper elevation). */
function AndroidMaterialTabs() {
  const { colors: c, scheme } = useThemeColors();
  const isDark = scheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.tint,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          letterSpacing: 0.15,
        },
        tabBarIconStyle: { marginTop: 2 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="us"
        options={{
          title: 'Us',
          tabBarIcon: ({ color, size = 24, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="moments"
        options={{
          title: 'Moments',
          tabBarIcon: ({ color, size = 24, focused }) => (
            <Ionicons name={focused ? 'images' : 'images-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size = 24, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size = 24, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function IosNativeTabs() {
  const { colors: c, scheme } = useThemeColors();

  const tabBarBackground = isIOS26OrHigher ? 'transparent' : c.background;

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
        <Icon
          sf={
            {
              default: 'heart.circle',
              selected: 'heart.circle.fill',
            } as never
          }
        />
        <Label>Us</Label>
        <NativeTabs.Trigger.TabBar {...tabBarProps} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="moments">
        <Icon
          sf={
            {
              default: 'photo.on.rectangle',
              selected: 'photo.on.rectangle.fill',
            } as never
          }
        />
        <Label>Moments</Label>
        <NativeTabs.Trigger.TabBar {...tabBarProps} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <Icon
          sf={
            {
              default: 'calendar',
              selected: 'calendar.circle.fill',
            } as never
          }
        />
        <Label>Calendar</Label>
        <NativeTabs.Trigger.TabBar {...tabBarProps} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon
          sf={
            {
              default: 'gearshape',
              selected: 'gearshape.fill',
            } as never
          }
        />
        <Label>Settings</Label>
        <NativeTabs.Trigger.TabBar {...tabBarProps} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === 'android') {
    return <AndroidMaterialTabs />;
  }
  return <IosNativeTabs />;
}
