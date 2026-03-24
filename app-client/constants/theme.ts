import { Platform } from 'react-native';

const tintColorLight = '#B42323';
const tintColorDark = '#FF6B6B';

export const Colors = {
  light: {
    /** Primary body / headings — ~15:1 on cream */
    text: '#1C1917',
    /** Secondary labels, captions — ≥4.5:1 on #F8F4E3 */
    textMuted: '#4B5563',
    textSecondary: '#4B5563',
    background: '#F8F4E3',
    backgroundSecondary: '#F0EBD8',
    /** Icons & links on page background — ≥4.5:1 on cream */
    tint: tintColorLight,
    /** Solid buttons / filled chips — paired with textOnPrimary */
    accent: '#B45309',
    love: '#C53030',
    icon: '#1C1917',
    iconMuted: '#4B5563',
    tabIconDefault: '#4B5563',
    tabIconSelected: tintColorLight,
    textOnPrimary: '#FFFFFF',
    textOnPrimaryMuted: 'rgba(255, 255, 255, 0.7)',
    glass: 'rgba(255, 255, 255, 0.92)',
    glassBorder: 'rgba(0, 0, 0, 0.12)',
    glassLight: 'rgba(255, 255, 255, 0.75)',
    card: '#FFFFFF',
    cardBorder: 'rgba(0, 0, 0, 0.1)',
    inputBg: 'rgba(255, 255, 255, 0.9)',
    inputBorder: 'rgba(0, 0, 0, 0.08)',
    divider: 'rgba(0, 0, 0, 0.06)',
    shadow: 'rgba(0, 0, 0, 0.08)',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    online: '#34C759',
    sent: '#9CA3AF',
    delivered: '#6B7280',
    read: '#C53030',
    /** Outgoing bubble — white text ≥4.5:1 (avoid light coral + white ~2.8:1) */
    myBubble: '#B42323',
    myBubbleText: '#FFFFFF',
    /** Timestamps & non-“read” ticks on outgoing bubble */
    myBubbleMuted: '#FECACA',
    partnerBubble: '#FFFFFF',
    partnerBubbleText: '#1C1917',
    partnerBubbleBorder: 'rgba(0, 0, 0, 0.12)',
  },
  dark: {
    text: '#F8F4E3',
    textMuted: 'rgba(248, 244, 227, 0.5)',
    textSecondary: '#9CA3AF',
    background: '#1C1C1E',
    backgroundSecondary: '#2C2C2E',
    tint: tintColorDark,
    accent: '#FF8360',
    love: '#FF6B6B',
    icon: '#F8F4E3',
    iconMuted: 'rgba(248, 244, 227, 0.5)',
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
    textOnPrimary: '#FFFFFF',
    textOnPrimaryMuted: 'rgba(255, 255, 255, 0.7)',
    glass: 'rgba(44, 44, 46, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    glassLight: 'rgba(44, 44, 46, 0.5)',
    card: 'rgba(44, 44, 46, 0.85)',
    cardBorder: 'rgba(255, 255, 255, 0.06)',
    inputBg: 'rgba(44, 44, 46, 0.9)',
    inputBorder: 'rgba(255, 255, 255, 0.08)',
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
  },
};

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
  thoughtful: { icon: 'cloud', sf: 'cloud.fill', color: '#5AC8FA' },
  sad: { icon: 'rainy', sf: 'cloud.rain.fill', color: '#5856D6' },
  tired: { icon: 'moon', sf: 'moon.zzz.fill', color: '#AF52DE' },
  playful: { icon: 'game-controller', sf: 'gamecontroller.fill', color: '#FF2D55' },
};

/** Long-press reactions: heart, star, thumbs up, flame (SF on iOS). */
export const ReactionIcons = [
  { name: 'heart', icon: 'heart', sf: 'heart.fill', color: '#FF6B6B' },
  { name: 'star', icon: 'star', sf: 'star.fill', color: '#FFD60A' },
  { name: 'thumbsup', icon: 'thumbs-up', sf: 'hand.thumbsup.fill', color: '#34C759' },
  { name: 'flame', icon: 'flame', sf: 'flame.fill', color: '#FF9500' },
] as const;

export const API_URL = 'https://onlyus-backend.loca.lt';

/** LocalTunnel (loca.lt) serves an HTML “reminder” page unless this header is set on requests. */
export function localTunnelHeaders(): Record<string, string> {
  if (!API_URL.includes('loca.lt') && !API_URL.includes('localtunnel')) return {};
  return { 'bypass-tunnel-reminder': 'true' };
}
