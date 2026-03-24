import { AccessibilityInfo, Platform } from 'react-native';
import { useEffect, useState } from 'react';

export function useAccessibilitySettings() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const rm = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) setReduceMotion(rm);
        if (Platform.OS === 'ios') {
          const dark = await AccessibilityInfo.isDarkerSystemColorsEnabled();
          if (mounted) setHighContrast(dark);
        } else {
          const hc = await AccessibilityInfo.isHighTextContrastEnabled();
          if (mounted) setHighContrast(hc);
        }
      } catch {
        /* ignore */
      }
    };

    load();

    const subRm = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const subHc =
      Platform.OS === 'ios'
        ? AccessibilityInfo.addEventListener('darkerSystemColorsChanged', setHighContrast)
        : AccessibilityInfo.addEventListener('highTextContrastChanged', setHighContrast);

    return () => {
      mounted = false;
      subRm.remove();
      subHc.remove();
    };
  }, []);

  return { reduceMotion, highContrast };
}
