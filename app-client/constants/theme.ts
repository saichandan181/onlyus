import { Platform } from 'react-native';

export const Colors = {
  /** Default OnlyUs palette — matches app settings “OnlyUs” preset */
  light: {
    text: '#1C1917',
    textMuted: '#4B5563',
    textSecondary: '#4B5563',
    background: '#F8F4E3',
    backgroundSecondary: '#F0EBD8',
    tint: '#B42323',
    accent: '#B45309',
    love: '#C53030',
    icon: '#1C1917',
    iconMuted: '#4B5563',
    tabIconDefault: '#4B5563',
    tabIconSelected: '#B42323',
    textOnPrimary: '#FFFFFF',
    textOnPrimaryMuted: 'rgba(255, 255, 255, 0.7)',
    glass: 'rgba(255, 255, 255, 0.92)',
    glassBorder: 'rgba(0, 0, 0, 0.12)',
    glassLight: 'rgba(255, 255, 255, 0.75)',
    card: '#FFFFFF',
    cardBorder: 'rgba(0, 0, 0, 0.1)',
    inputBg: 'rgba(255, 255, 255, 0.9)',
    inputBorder: 'rgba(0, 0, 0, 0.08)',
    inputPlaceholder: '#6B7280',
    divider: 'rgba(0, 0, 0, 0.06)',
    shadow: 'rgba(0, 0, 0, 0.08)',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    online: '#34C759',
    sent: '#9CA3AF',
    delivered: '#6B7280',
    read: '#C53030',
    myBubble: '#B42323',
    myBubbleText: '#FFFFFF',
    myBubbleMuted: '#FECACA',
    partnerBubble: '#FFFFFF',
    partnerBubbleText: '#1C1917',
    partnerBubbleBorder: 'rgba(0, 0, 0, 0.12)',
    linkOnBubble: '#1D4ED8',
    reactionBadgeBg: '#FFFFFF',
    reactionBadgeBorder: 'rgba(0, 0, 0, 0.14)',
    reactionPickerBg: '#FFFFFF',
    reactionPickerBorder: 'rgba(0, 0, 0, 0.12)',
  },
  dark: {
    text: '#F8F4E3',
    textMuted: 'rgba(248, 244, 227, 0.5)',
    textSecondary: '#9CA3AF',
    background: '#1C1C1E',
    backgroundSecondary: '#2C2C2E',
    tint: '#FF6B6B',
    accent: '#FF8360',
    love: '#FF6B6B',
    icon: '#F8F4E3',
    iconMuted: 'rgba(248, 244, 227, 0.5)',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#FF6B6B',
    textOnPrimary: '#FFFFFF',
    textOnPrimaryMuted: 'rgba(255, 255, 255, 0.7)',
    glass: 'rgba(44, 44, 46, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    glassLight: 'rgba(44, 44, 46, 0.5)',
    card: 'rgba(44, 44, 46, 0.85)',
    cardBorder: 'rgba(255, 255, 255, 0.06)',
    inputBg: 'rgba(44, 44, 46, 0.9)',
    inputBorder: 'rgba(255, 255, 255, 0.08)',
    inputPlaceholder: '#AEAEB2',
    divider: 'rgba(255, 255, 255, 0.06)',
    shadow: 'rgba(0, 0, 0, 0.3)',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
    online: '#30D158',
    sent: '#6B7280',
    delivered: '#9CA3AF',
    read: '#FF6B6B',
    myBubble: '#FF6B6B',
    myBubbleText: '#FFFFFF',
    myBubbleMuted: 'rgba(255, 255, 255, 0.75)',
    partnerBubble: 'rgba(44, 44, 46, 0.85)',
    partnerBubbleText: '#F8F4E3',
    partnerBubbleBorder: 'rgba(255, 255, 255, 0.12)',
    linkOnBubble: '#8EC8FF',
    reactionBadgeBg: 'rgba(44, 44, 46, 0.95)',
    reactionBadgeBorder: 'rgba(255, 255, 255, 0.2)',
    reactionPickerBg: 'rgba(44, 44, 46, 0.95)',
    reactionPickerBorder: 'rgba(255, 255, 255, 0.14)',
  },
};

/** Resolved theme object (light or dark palette row). */
export type AppThemeColors = (typeof Colors)['light'];

export type ThemePaletteId = 'onlyus' | 'paper' | 'graphite';

export const THEME_PALETTE_META: Record<
  ThemePaletteId,
  { label: string; description: string }
> = {
  onlyus: {
    label: 'OnlyUs',
    description: 'Cream & deep red — brand default',
  },
  paper: {
    label: 'Warm paper',
    description: 'Soft ivory backgrounds, easy on the eyes',
  },
  graphite: {
    label: 'Graphite',
    description: 'Cool neutrals with slate accents',
  },
};

const PALETTE_OVERRIDES: Record<
  ThemePaletteId,
  { light: Partial<AppThemeColors>; dark: Partial<AppThemeColors> }
> = {
  onlyus: { light: {}, dark: {} },
  paper: {
    light: {
      background: '#FFF9ED',
      backgroundSecondary: '#F3EDE5',
      card: '#FFFFFF',
      inputBg: '#FFFFFF',
      partnerBubble: '#F2EDE6',
      partnerBubbleText: '#1C1917',
      partnerBubbleBorder: 'rgba(0, 0, 0, 0.1)',
    },
    dark: {
      background: '#121212',
      backgroundSecondary: '#1A1A1C',
      partnerBubble: '#2E2E32',
      partnerBubbleBorder: 'rgba(255, 255, 255, 0.12)',
      reactionPickerBg: '#2E2E32',
    },
  },
  graphite: {
    light: {
      background: '#F8FAFC',
      backgroundSecondary: '#F1F5F9',
      text: '#0F172A',
      tint: '#1E40AF',
      accent: '#334155',
      myBubble: '#1E293B',
      myBubbleMuted: 'rgba(255, 255, 255, 0.78)',
      tabIconSelected: '#1E40AF',
      partnerBubble: '#FFFFFF',
      partnerBubbleText: '#0F172A',
      linkOnBubble: '#1D4ED8',
    },
    dark: {
      background: '#020617',
      backgroundSecondary: '#0F172A',
      text: '#F1F5F9',
      textMuted: '#94A3B8',
      textSecondary: '#CBD5E1',
      tint: '#93C5FD',
      accent: '#94A3B8',
      myBubble: '#334155',
      partnerBubble: '#1E293B',
      partnerBubbleBorder: 'rgba(148, 163, 184, 0.2)',
      linkOnBubble: '#7DD3FC',
      reactionPickerBg: '#1E293B',
    },
  },
};

export function getPaletteColors(
  paletteId: ThemePaletteId,
  scheme: 'light' | 'dark'
): AppThemeColors {
  const base = Colors[scheme] as AppThemeColors;
  const overrides = (PALETTE_OVERRIDES[paletteId]?.[scheme] ?? {}) as Partial<AppThemeColors>;
  return { ...base, ...overrides };
}

/** Icon colors on reaction picker bar — WCAG-friendly on white / dark gray */
export const REACTION_PICKER_ICON_COLORS = {
  heart: '#BE123C',
  star: '#A16207',
  thumbsup: '#047857',
  flame: '#C2410C',
} as const;

export function reactionPickerIconColor(name: keyof typeof REACTION_PICKER_ICON_COLORS): string {
  return REACTION_PICKER_ICON_COLORS[name];
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'System',
    serif: 'serif',
    rounded: 'System',
    mono: 'monospace',
  },
});

export const Typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, lineHeight: 41 },
  title1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  title3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 25 },
  headline: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 22 },
  callout: { fontSize: 16, fontWeight: '400' as const, lineHeight: 21 },
  subhead: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption1: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  caption2: { fontSize: 11, fontWeight: '400' as const, lineHeight: 13 },
};

export const GlassStyle = {
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  dark: {
    backgroundColor: 'rgba(44, 44, 46, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
};

// Mood: Ionicons fallback (Android) + SF Symbol names (iOS) — no emojis
export const MoodIcons: Record<
  string,
  { icon: string; sf: string; color: string }
> = {
  happy: { icon: 'sunny', sf: 'sun.max.fill', color: '#FFD60A' },
  love: { icon: 'heart', sf: 'heart.fill', color: '#FF6B6B' },
  excited: { icon: 'sparkles', sf: 'sparkles', color: '#FF9500' },
  calm: { icon: 'leaf', sf: 'leaf.fill', color: '#34C759' },
  thoughtful: { icon: 'cloud', sf: 'cloud.fill', color: '#8EB4FF' },
  sad: { icon: 'rainy', sf: 'cloud.rain.fill', color: '#5856D6' },
  tired: { icon: 'moon', sf: 'moon.zzz.fill', color: '#AF52DE' },
  playful: { icon: 'game-controller', sf: 'gamecontroller.fill', color: '#FF2D55' },
};

/** Long-press reactions: heart, star, thumbs up, flame (SF on iOS). */
export const ReactionIcons = [
  { name: 'heart', icon: 'heart', sf: 'heart.fill', color: '#FF6B6B' },
  { name: 'star', icon: 'star', sf: 'star.fill', color: '#FFD60A' },
  { name: 'thumbsup', icon: 'thumbs-up', sf: 'hand.thumbsup.fill', color: '#FF8360' },
  { name: 'flame', icon: 'flame', sf: 'flame.fill', color: '#FF9500' },
] as const;

/** Map common emoji payloads to internal reaction keys (cross-client / future web). */
const REACTION_EMOJI_TO_KEY: Record<string, (typeof ReactionIcons)[number]['name']> = {
  '❤️': 'heart',
  '❤': 'heart',
  '👍': 'thumbsup',
  '🔥': 'flame',
  '⭐': 'star',
  '🌟': 'star',
};

export function normalizeReactionKey(raw: string): string {
  const t = raw.trim();
  if ((ReactionIcons as readonly { name: string }[]).some((r) => r.name === t)) return t;
  return REACTION_EMOJI_TO_KEY[t] ?? t;
}

export const API_URL = 'https://onlyus-backend.loca.lt';

/** LocalTunnel (loca.lt) serves an HTML “reminder” page unless this header is set on requests. */
export function localTunnelHeaders(): Record<string, string> {
  if (!API_URL.includes('loca.lt') && !API_URL.includes('localtunnel')) return {};
  return { 'bypass-tunnel-reminder': 'true' };
}
