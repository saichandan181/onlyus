import React, { useEffect } from 'react';
import { Modal, View, Pressable, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  clamp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { AppSymbol } from '@/components/ui/AppSymbol';

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

type Props = {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  topInset: number;
};

/**
 * Full-screen profile photo with pinch-to-zoom and close control.
 * Works with data URIs, https, and local file URIs.
 */
export function AvatarFullScreenModal({ uri, visible, onClose, topInset }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, ZOOM_MIN, ZOOM_MAX);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withSpring(ZOOM_MIN);
        savedScale.value = ZOOM_MIN;
      }
    });

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const headerPad = topInset + 8;
  const imageH = Math.max(200, H - headerPad - 52);

  useEffect(() => {
    if (!visible) {
      scale.value = ZOOM_MIN;
      savedScale.value = ZOOM_MIN;
    }
  }, [savedScale, scale, visible]);

  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: headerPad }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close full screen photo"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeHit}
          >
            <AppSymbol sf="xmark.circle.fill" ion="close-circle" size={34} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>

        <View style={styles.gestureWrap}>
          <GestureDetector gesture={pinch}>
            <Animated.View style={[styles.stage, zoomStyle]}>
              <Image
                source={{ uri }}
                style={{ width: W, height: imageH }}
                resizeMode="contain"
                accessibilityLabel="Profile photo"
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  closeHit: {
    padding: 4,
  },
  gestureWrap: {
    flex: 1,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
