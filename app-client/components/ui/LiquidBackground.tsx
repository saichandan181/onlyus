import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';

type Props = {
  variant: 'light' | 'dark';
  /** Optional mood tint (warm shift). */
  moodTint?: string | null;
  style?: ViewStyle;
  children?: React.ReactNode;
};

const LIGHT = ['#F8F4E3', '#F0EBD8', '#F5EFE0'] as const;
const DARK = ['#1C1C1E', '#252528', '#1C1C1E'] as const;

export function LiquidBackground({ variant, moodTint, style, children }: Props) {
  const base = variant === 'light' ? LIGHT : DARK;
  return (
    <View style={[styles.flex, style]}>
      <LinearGradient
        colors={moodTint ? [base[0], moodTint, base[2]] : [...base]}
        locations={moodTint ? [0, 0.5, 1] : undefined}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
