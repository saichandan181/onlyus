import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Platform, View } from 'react-native';

type IonName = React.ComponentProps<typeof Ionicons>['name'];

type AppSymbolProps = {
  /** SF Symbol name (iOS). */
  sf: SFSymbol;
  /** Ionicons fallback name (Android / web). */
  ion: IonName;
  size: number;
  color: string;
  style?: object;
};

/**
 * SF Symbols on iOS; vector fallback elsewhere for Expo Go compatibility.
 */
export function AppSymbol({ sf, ion, size, color, style }: AppSymbolProps) {
  if (Platform.OS === 'ios') {
    return (
      <View style={style}>
        <SymbolView name={sf} size={size} tintColor={color} resizeMode="scaleAspectFit" />
      </View>
    );
  }
  return <Ionicons name={ion} size={size} color={color} style={style} />;
}
