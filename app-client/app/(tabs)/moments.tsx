import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  Dimensions,
  Modal,
  SectionList,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type SectionListRenderItemInfo,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAccessibilitySettings } from '@/hooks/use-accessibility-settings';
import { Typography, BorderRadius, type AppThemeColors } from '@/constants/theme';
import { AppSymbol } from '@/components/ui/AppSymbol';
import { getMediaMessages } from '@/services/database';
import { Message } from '@/services/api';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const GAP = 10;
const CELL = (width - GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

type MomentSection = { title: string; data: Message[][] };

function chunkPair<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push(arr.slice(i, i + 2));
  }
  return out;
}

export default function MomentsScreen() {
  const { colors, scheme } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilitySettings();

  const [mediaMessages, setMediaMessages] = useState<Message[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const scrollY = useSharedValue(0);
  const tint: 'light' | 'dark' | 'default' = scheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      const media = await getMediaMessages();
      setMediaMessages(media);
    } catch (err) {
      console.error('Failed to load media:', err);
    }
  };

  const formatDate = (time: string) => {
    const d = new Date(time);
    return d.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const grouped = mediaMessages.reduce<Record<string, Message[]>>((acc, msg) => {
    const date = formatDate(msg.time);
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  const sections: MomentSection[] = Object.entries(grouped).map(([title, items]) => ({
    title,
    data: chunkPair(items),
  }));

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY]
  );

  const renderItem = useCallback(
    ({ item: pair, index: rowIndex }: SectionListRenderItemInfo<Message[]>) => (
      <View style={styles.row}>
        {pair.map((msg, i) => {
          const tall = (rowIndex + i) % 3 !== 0;
          const h = tall ? CELL * 1.25 : CELL * 0.95;
          return (
            <Pressable
              key={msg.id}
              onPress={() => setSelectedMedia(msg)}
              style={[styles.cell, { height: h, width: CELL }]}
            >
              <ParallaxThumb
                uri={msg.media_uri}
                type={msg.type}
                colors={colors}
                scrollY={scrollY}
                index={rowIndex * 2 + i}
                reduceMotion={reduceMotion}
              />
            </Pressable>
          );
        })}
      </View>
    ),
    [colors, scrollY, reduceMotion]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlurView
        intensity={70}
        tint={tint}
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.glassBorder,
          },
        ]}
      >
        <Text style={[Typography.largeTitle, { color: colors.text }]} accessibilityRole="header">
          Moments
        </Text>
        <Text style={[Typography.footnote, { color: colors.textMuted, marginTop: 4 }]}>
          {mediaMessages.length} shared memories
        </Text>
      </BlurView>

      {mediaMessages.length === 0 ? (
        <View style={styles.emptyState}>
          <BlurView intensity={45} tint={tint} style={[styles.emptyCircle, { borderColor: colors.glassBorder }]}>
            <AppSymbol sf="photo.on.rectangle.angled" ion="images" size={48} color={colors.tint} />
          </BlurView>
          <Text style={[Typography.title3, { color: colors.text, marginTop: 16, textAlign: 'center' }]}>
            No moments yet
          </Text>
          <Text style={[Typography.callout, { color: colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
            Share photos and videos in chat to see them here
          </Text>
        </View>
      ) : (
        <SectionList<Message[], MomentSection>
          sections={sections}
          keyExtractor={(row: Message[], idx: number) => `${row.map((m: Message) => m.id).join('-')}-${idx}`}
          renderItem={renderItem}
          stickySectionHeadersEnabled
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderSectionHeader={({ section }) => (
            <BlurView intensity={55} tint={tint} style={[styles.stickyHeader, { borderColor: colors.glassBorder }]}>
              <Text style={[Typography.caption1, { color: colors.textMuted, fontWeight: '600', letterSpacing: 0.6 }]}>
                {section.title.toUpperCase()}
              </Text>
            </BlurView>
          )}
          contentContainerStyle={{ paddingHorizontal: GAP, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={!!selectedMedia} transparent animationType="fade" onRequestClose={() => setSelectedMedia(null)}>
        <View style={[styles.modalRoot, { backgroundColor: 'rgba(0,0,0,0.88)' }]}>
          <BlurView
            intensity={60}
            tint="dark"
            style={[styles.modalTopBar, { paddingTop: insets.top + 8 }]}
          >
            <Pressable
              accessibilityLabel="Close"
              onPress={() => setSelectedMedia(null)}
              style={[styles.modalBtn, { borderColor: 'rgba(255,255,255,0.2)' }]}
            >
              <AppSymbol sf="xmark" ion="close" size={22} color="#FFF" />
            </Pressable>
            <View style={styles.modalActions}>
              <Pressable accessibilityLabel="Save" style={[styles.modalBtn, { borderColor: 'rgba(255,255,255,0.2)' }]}>
                <AppSymbol sf="square.and.arrow.down" ion="download-outline" size={20} color="#FFF" />
              </Pressable>
              <Pressable accessibilityLabel="Share" style={[styles.modalBtn, { borderColor: 'rgba(255,255,255,0.2)' }]}>
                <AppSymbol sf="square.and.arrow.up" ion="share-outline" size={20} color="#FFF" />
              </Pressable>
            </View>
          </BlurView>
          {selectedMedia?.media_uri && (
            <Image source={{ uri: selectedMedia.media_uri }} style={styles.fullImage} contentFit="contain" />
          )}
          {selectedMedia?.caption ? (
            <Text style={styles.captionText}>{selectedMedia.caption}</Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function ParallaxThumb({
  uri,
  type,
  colors,
  scrollY,
  index,
  reduceMotion,
}: {
  uri?: string;
  type: Message['type'];
  colors: AppThemeColors;
  scrollY: SharedValue<number>;
  index: number;
  reduceMotion: boolean;
}) {
  const baseOffset = index * 22;
  const style = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const y = scrollY.value;
    const shift = interpolate(y + baseOffset, [0, 400], [0, 12], Extrapolation.CLAMP);
    return { transform: [{ translateY: -shift * 0.15 }] };
  });

  return (
    <Animated.View style={[styles.thumbWrap, style]}>
      <BlurView intensity={35} tint="default" style={[styles.thumbGlass, { borderColor: colors.glassBorder }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.card }]}>
            <AppSymbol
              sf={type === 'video' ? 'video.fill' : 'photo'}
              ion={type === 'video' ? 'videocam' : 'image'}
              size={28}
              color={colors.iconMuted}
            />
          </View>
        )}
        {type === 'video' && (
          <View style={styles.videoOverlay}>
            <AppSymbol sf="play.circle.fill" ion="play-circle" size={32} color="#FFFFFF" />
          </View>
        )}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  stickyHeader: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  thumbWrap: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  thumbGlass: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalRoot: { flex: 1 },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  fullImage: {
    flex: 1,
    width: '100%',
  },
  captionText: {
    color: '#FFF',
    ...Typography.callout,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
