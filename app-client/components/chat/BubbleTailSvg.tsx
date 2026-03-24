import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

/**
 * Smooth iMessage-style bubble tail (curved, not a sharp triangle).
 * Single SVG path per side; mirrored for incoming messages.
 */
const VB_W = 14;
const VB_H = 20;

/** Bottom-right tail — cubic curves for a soft “droplet” */
const PATH_TAIL_RIGHT =
  'M0 3.2 C0 11.5 3.8 17.5 11 19.8 C12.2 14.5 13.2 7.5 13.2 3.2 C13.2 0.8 10.5 0 6.8 0 C3.2 0 0 1.2 0 3.2 Z';

type Props = {
  fill: string;
  side: 'left' | 'right';
};

export function BubbleTailSvg({ fill, side }: Props) {
  const mirror = side === 'left';
  return (
    <View
      style={[styles.wrap, mirror ? styles.posLeft : styles.posRight]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={VB_W} height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <G transform={mirror ? `translate(${VB_W}, 0) scale(-1, 1)` : undefined}>
          <Path d={PATH_TAIL_RIGHT} fill={fill} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: -0.5,
    zIndex: 0,
  },
  posRight: {
    right: -3,
  },
  posLeft: {
    left: -3,
  },
});
