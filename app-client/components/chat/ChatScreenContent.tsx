import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  FlatList,
  useWindowDimensions,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  clamp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { getDocumentAsync } from 'expo-document-picker';
import { Audio, Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import type { SFSymbol } from 'sf-symbols-typescript';
import { createMessageId } from '@/utils/messageId';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAccessibilitySettings } from '@/hooks/use-accessibility-settings';
import {
  Typography,
  BorderRadius,
  MoodIcons,
  ReactionIcons,
  normalizeReactionKey,
  reactionPickerIconColor,
  REACTION_PICKER_ICON_COLORS,
  type AppThemeColors,
} from '@/constants/theme';
import { BubbleTailSvg } from '@/components/chat/BubbleTailSvg';
import { IOS_PHOTO_LIBRARY_OPTIONS, IOS_VIDEO_LIBRARY_OPTIONS } from '@/constants/imagePicker';
import { AppSymbol } from '@/components/ui/AppSymbol';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useSocket } from '@/hooks/useSocket';
import { Message } from '@/services/api';
import { encryptMessage, decryptMessage } from '@/services/encryption';
import { useRouter } from 'expo-router';
import { sendEncryptedMediaAttachment } from '@/services/sendChatMedia';
import {
  MAX_VOICE_RECORD_SECONDS,
  MAX_VIDEO_PICK_DURATION_SECONDS,
} from '@/constants/mediaLimits';
import { canDisplayAvatarUri } from '@/utils/avatarImage';
import { AvatarFullScreenModal } from '@/components/ui/AvatarFullScreenModal';

const AUDIO_WAVEFORM = [10, 18, 14, 24, 16, 28, 20, 12, 22, 30, 18, 26, 14, 24, 16, 21];

type ListRow =
  | { rowKind: 'date'; id: string; time: string }
  | { rowKind: 'message'; id: string; message: Message };

function buildRows(messages: Message[]): ListRow[] {
  const out: ListRow[] = [];
  let lastDayKey = '';
  for (const m of messages) {
    const d = new Date(m.time);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDayKey) {
      out.push({ rowKind: 'date', id: `date-${dayKey}-${m.id}`, time: m.time });
      lastDayKey = dayKey;
    }
    out.push({ rowKind: 'message', id: m.id, message: m });
  }
  return out;
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatClockTime(time: string) {
  return new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(seconds?: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return '--:--';
  const safeSeconds = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDateSeparatorLabel(time: string) {
  const date = new Date(time);
  const today = new Date();
  if (isSameCalendarDay(date, today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function inferMediaLabel(message: Message) {
  if (message.file_name?.trim()) return message.file_name.trim();

  if (message.media_uri && !message.media_uri.startsWith('data:')) {
    try {
      const withoutQuery = message.media_uri.split('?')[0];
      const segment = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
      const decoded = decodeURIComponent(segment);
      if (decoded) return decoded;
    } catch {
      // Ignore parse failures and fall through to friendly labels.
    }
  }

  switch (message.type) {
    case 'image':
      return 'Photo.jpg';
    case 'video':
      return 'Clip.mp4';
    case 'audio':
      return 'Voice note.m4a';
    default:
      return 'Attachment';
  }
}

function TypingIndicatorBubble({ colors }: { colors: AppThemeColors }) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })), -1);
    const t2 = setTimeout(() => {
      dot2.value = withRepeat(withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })), -1);
    }, 100);
    const t3 = setTimeout(() => {
      dot3.value = withRepeat(withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })), -1);
    }, 200);
    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [dot1, dot2, dot3]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View style={styles.typingContainer}>
      <View
        style={[
          styles.typingBubble,
          {
            backgroundColor: colors.partnerBubble,
            borderColor: colors.partnerBubbleBorder,
          },
        ]}
      >
        <BubbleTailSvg fill={colors.partnerBubble} side="left" />
        <View style={styles.typingInner}>
          <Animated.View style={[styles.typingDot, { backgroundColor: colors.textMuted }, s1]} />
          <Animated.View style={[styles.typingDot, { backgroundColor: colors.textMuted }, s2]} />
          <Animated.View style={[styles.typingDot, { backgroundColor: colors.textMuted }, s3]} />
        </View>
      </View>
    </View>
  );
}

function DateSeparator({ time, colors }: { time: string; colors: AppThemeColors }) {
  const label = getDateSeparatorLabel(time);
  return (
    <View style={styles.dateSeparatorWrap}>
      <View style={[styles.dateSeparatorRule, { backgroundColor: colors.divider }]} />
      <View style={[styles.dateSeparatorPill, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
        <Text style={[Typography.caption1, styles.dateSeparatorText, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>
      <View style={[styles.dateSeparatorRule, { backgroundColor: colors.divider }]} />
    </View>
  );
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

function ChatImageFullScreenModal({
  uri,
  visible,
  onClose,
  topInset,
}: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  topInset: number;
}) {
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
      <View style={styles.imageViewerRoot}>
        <View style={[styles.imageViewerHeader, { paddingTop: headerPad }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close full screen image"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.imageViewerCloseHit}
          >
            <AppSymbol sf="xmark.circle.fill" ion="close-circle" size={34} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>

        <View style={styles.imageViewerGesture}>
          <GestureDetector gesture={pinch}>
            <Animated.View style={[styles.imageViewerStage, zoomStyle]}>
              <Image
                source={{ uri }}
                style={{ width: W, height: imageH }}
                resizeMode="contain"
                accessibilityLabel="Full screen photo"
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </Modal>
  );
}

function ChatVideoFullScreenModal({
  uri,
  visible,
  onClose,
  topInset,
}: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  topInset: number;
}) {
  const videoRef = useRef<InstanceType<typeof Video> | null>(null);

  useEffect(() => {
    if (!visible) {
      void videoRef.current?.pauseAsync();
      void videoRef.current?.setPositionAsync(0);
      return;
    }
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    });
  }, [visible]);

  if (!uri) return null;

  const headerPad = topInset + 8;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <View style={styles.videoModalRoot}>
        <View style={[styles.videoModalHeader, { paddingTop: headerPad }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close video"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.imageViewerCloseHit}
          >
            <AppSymbol sf="xmark.circle.fill" ion="close-circle" size={34} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>
        <View style={styles.videoModalStage}>
          <Video
            ref={videoRef}
            source={{ uri }}
            style={StyleSheet.absoluteFillObject}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={visible}
            isLooping={false}
          />
        </View>
      </View>
    </Modal>
  );
}

function ChatAudioBubble({
  uri,
  colors,
  isMine,
  fontScale,
  durationSec,
}: {
  uri: string;
  colors: AppThemeColors;
  isMine: boolean;
  fontScale: number;
  durationSec?: number;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(durationSec != null ? durationSec * 1000 : 0);

  const handlePlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setPlaying(false);
      return;
    }

    setPlaying(status.isPlaying);
    setPositionMs(status.positionMillis ?? 0);
    if (status.durationMillis != null) {
      setDurationMs(status.durationMillis);
    }

    if (status.didJustFinish) {
      setPlaying(false);
      setPositionMs(0);
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (durationMs > 0) return;

    void (async () => {
      try {
        const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false }, undefined, false);
        if (!cancelled && status.isLoaded && status.durationMillis != null) {
          setDurationMs(status.durationMillis);
        }
        await sound.unloadAsync();
      } catch {
        // Metadata loading is optional.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [durationMs, uri]);

  const toggle = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return;
        }
        if (status.isLoaded) {
          await soundRef.current.playAsync();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return;
        }
      }
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 120 },
        handlePlaybackStatus
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(handlePlaybackStatus);
      setPlaying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn('[ChatAudioBubble]', e);
      setPlaying(false);
      setPositionMs(0);
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    }
  };

  const totalDurationSec = durationMs > 0 ? durationMs / 1000 : durationSec;
  const elapsedSec = positionMs > 0 ? positionMs / 1000 : 0;
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const activeBars = Math.max(0, Math.round(progress * AUDIO_WAVEFORM.length));
  const textColor = isMine ? colors.myBubbleText : colors.partnerBubbleText;
  const secondaryTextColor = isMine ? colors.myBubbleMuted : colors.textMuted;

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
      style={styles.audioBubbleRow}
    >
      <View
        style={[
          styles.audioPlayButton,
          {
            backgroundColor: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <AppSymbol
          sf={playing ? 'pause.fill' : 'play.fill'}
          ion={playing ? 'pause' : 'play'}
          size={18 * fontScale}
          color={textColor}
          style={playing ? undefined : { marginLeft: 2 }}
        />
      </View>

      <View style={styles.audioWaveSection}>
        <View style={styles.audioWaveformRow}>
          {AUDIO_WAVEFORM.map((height, index) => {
            const filled = index < activeBars || (playing && index === activeBars);
            return (
              <View
                key={`${height}-${index}`}
                style={[
                  styles.audioWaveBar,
                  {
                    height,
                    opacity: filled ? 1 : 0.3,
                    backgroundColor: filled ? textColor : secondaryTextColor,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.audioTimeRow}>
          <Text style={[styles.audioTimeText, { color: secondaryTextColor, fontSize: 11 * fontScale }]}>
            {formatDuration(elapsedSec)}
          </Text>
          <Text style={[styles.audioTimeText, { color: secondaryTextColor, fontSize: 11 * fontScale }]}>
            {formatDuration(totalDurationSec)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function MessageStatusIndicator({
  status,
  colors,
  fontScale,
}: {
  status: Message['status'];
  colors: AppThemeColors;
  fontScale: number;
}) {
  if (status === 'sending') {
    return (
      <AppSymbol
        sf="clock"
        ion="time-outline"
        size={12 * fontScale}
        color={colors.myBubbleMuted}
        style={styles.receiptSending}
      />
    );
  }

  const tickColor = status === 'read' ? colors.textOnPrimary : colors.myBubbleMuted;
  const tickIcon = <AppSymbol sf="checkmark" ion="checkmark" size={11 * fontScale} color={tickColor} />;

  if (status === 'sent') {
    return <View style={styles.receiptSingle}>{tickIcon}</View>;
  }

  return (
    <View style={styles.receiptDouble}>
      <View style={styles.receiptDoubleLead}>{tickIcon}</View>
      <View style={styles.receiptDoubleTrail}>{tickIcon}</View>
    </View>
  );
}

function MediaThumbnail({
  message,
  fontScale,
  onPress,
}: {
  message: Message;
  fontScale: number;
  onPress: () => void;
}) {
  const label = inferMediaLabel(message);
  const isVideo = message.type === 'video';
  const detail = isVideo ? formatDuration(message.duration) : 'Tap to expand';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isVideo ? 'Open video full screen' : 'View image full screen'}
      accessibilityHint="Opens the media in an expanded view"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.mediaCardPressable}
    >
      <View style={styles.mediaCard}>
        {isVideo ? (
          <View style={styles.videoThumbContainer}>
            <Video
              source={{ uri: message.media_uri! }}
              style={[styles.messageVideo, { maxHeight: 250 * fontScale }]}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isMuted
              useNativeControls={false}
              isLooping={false}
            />
          </View>
        ) : (
          <Image
            source={{ uri: message.media_uri }}
            style={[styles.messageImage, { maxHeight: 240 * fontScale }]}
            resizeMode="cover"
            accessibilityLabel="Shared image"
          />
        )}

        <View style={styles.mediaDimOverlay} pointerEvents="none" />

        {isVideo ? (
          <View style={styles.videoPlayOverlay} pointerEvents="none">
            <View style={styles.videoPlayButton}>
              <AppSymbol
                sf="play.fill"
                ion="play"
                size={26 * fontScale}
                color="rgba(255,255,255,0.95)"
                style={{ marginLeft: 2 }}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.mediaTopRight} pointerEvents="none">
          <View style={styles.mediaExpandBadge}>
            <AppSymbol
              sf="arrow.up.left.and.arrow.down.right"
              ion="expand-outline"
              size={14 * fontScale}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.mediaFooter} pointerEvents="none">
          <Text style={[styles.mediaName, { fontSize: 13 * fontScale }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.mediaMeta, { fontSize: 11 * fontScale }]} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function MessageBubble({
  message,
  isMine,
  sharedSecret,
  onReact,
  onDelete,
  onImagePress,
  onVideoPress,
  colors,
  scheme,
  highContrast,
  fontScale,
}: {
  message: Message;
  isMine: boolean;
  sharedSecret: string | null;
  onReact: (msgId: string, reaction: string) => void;
  onDelete: (msgId: string) => void;
  onImagePress?: (uri: string) => void;
  onVideoPress?: (uri: string) => void;
  colors: AppThemeColors;
  scheme: 'light' | 'dark';
  highContrast: boolean;
  fontScale: number;
}) {
  const [decryptedText, setDecryptedText] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const scale = useSharedValue(1);
  const uploadProgress = useChatStore(s => s.uploadProgressByMessageId[message.id]);
  const showUploadProgress =
    isMine &&
    message.status === 'sending' &&
    uploadProgress != null &&
    uploadProgress < 1 &&
    (message.type === 'image' || message.type === 'video' || message.type === 'audio');

  useEffect(() => {
    const decrypt = async () => {
      if (
        (message.type === 'image' || message.type === 'video' || message.type === 'audio') &&
        message.media_uri
      ) {
        setDecryptedText('');
        return;
      }
      if (sharedSecret && message.encrypted_payload.includes(':')) {
        try {
          const text = await decryptMessage(message.encrypted_payload, sharedSecret);
          setDecryptedText(text);
        } catch {
          setDecryptedText(message.encrypted_payload);
        }
      } else {
        setDecryptedText(message.encrypted_payload);
      }
    };
    decrypt();
  }, [message.encrypted_payload, message.type, message.media_uri, sharedSecret]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const reactions = useMemo(() => {
    try {
      const raw: unknown = JSON.parse(message.reactions || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.map((r) => (typeof r === 'string' ? normalizeReactionKey(r) : '')).filter(Boolean);
    } catch {
      return [];
    }
  }, [message.reactions]);

  const messageAccessibilityLabel = useMemo(() => {
    const kind =
      message.type === 'text'
        ? (decryptedText.trim() || 'Message')
        : `${message.type} message`;
    const who = isMine ? 'Your message' : `Message from ${message.sender_name?.trim() || 'partner'}`;
    const rx =
      reactions.length === 0
        ? ''
        : ` Reactions: ${reactions
            .map((k) => ReactionIcons.find((x) => x.name === k)?.name ?? k)
            .join(', ')}.`;
    return `${who}. ${kind}.${rx} ${formatClockTime(message.time)}.`;
  }, [
    message.type,
    message.sender_name,
    decryptedText,
    isMine,
    reactions,
    message.time,
  ]);

  const borderW = highContrast ? 1 : 0.5;
  const bubbleBackground = isMine ? colors.myBubble : colors.partnerBubble;
  const bubbleBorder = isMine
    ? scheme === 'light' && highContrast
      ? '#000000'
      : bubbleBackground
    : colors.partnerBubbleBorder;
  const textColor = isMine ? colors.myBubbleText : colors.partnerBubbleText;
  const metaColor = isMine ? colors.myBubbleMuted : colors.textMuted;
  const isMediaFrame = message.type === 'image' || message.type === 'video';

  const bubbleBody = (
      <View style={[styles.bubbleInner, isMediaFrame && styles.bubbleInnerMedia]}>
            {message.type === 'image' && message.media_uri ? (
              <MediaThumbnail message={message} fontScale={fontScale} onPress={() => onImagePress?.(message.media_uri!)} />
            ) : message.type === 'video' && message.media_uri ? (
              <MediaThumbnail message={message} fontScale={fontScale} onPress={() => onVideoPress?.(message.media_uri!)} />
            ) : message.type === 'audio' && message.media_uri ? (
              <ChatAudioBubble
                uri={message.media_uri}
                colors={colors}
                isMine={isMine}
                fontScale={fontScale}
                durationSec={message.duration}
              />
            ) : message.type === 'image' || message.type === 'video' || message.type === 'audio' ? (
              <Text
                style={[
                  styles.messageText,
                  {
                    color: textColor,
                    fontSize: Typography.body.fontSize * fontScale,
                    fontStyle: 'italic',
                  },
                ]}
              >
                Receiving media...
              </Text>
            ) : (
              <Text
                style={[
                  styles.messageText,
                  {
                    color: textColor,
                    fontSize: Typography.body.fontSize * fontScale,
                    lineHeight: (Typography.body.lineHeight ?? 22) * fontScale,
                  },
                ]}
              >
                {decryptedText}
              </Text>
            )}
            {showUploadProgress && (
              <View
                style={styles.uploadProgressRow}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(uploadProgress * 100),
                }}
              >
                <View
                  style={[
                    styles.uploadProgressTrack,
                    {
                      backgroundColor: isMine ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.1)',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.uploadProgressFill,
                      {
                        width: `${Math.round(uploadProgress * 100)}%`,
                        backgroundColor: isMine ? colors.myBubbleText : colors.tint,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.uploadPercentText,
                    {
                      color: metaColor,
                      fontSize: 11 * fontScale,
                    },
                  ]}
                >
                  {Math.round(uploadProgress * 100)}%
                </Text>
              </View>
            )}
            <View style={[styles.metaRow, !isMine && { justifyContent: 'flex-start' }]}>
              <Text
                style={[
                  styles.timeText,
                  {
                    color: metaColor,
                    fontSize: 11 * fontScale,
                  },
                ]}
              >
                {formatClockTime(message.time)}
              </Text>
              {isMine && <MessageStatusIndicator status={message.status} colors={colors} fontScale={fontScale} />}
            </View>
          </View>
  );

  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} style={[animStyle]}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={messageAccessibilityLabel}
        accessibilityHint="Opens reactions. Long press to add or change a reaction."
        accessibilityState={{ expanded: showReactions }}
        onLongPress={() => {
          setShowReactions(!showReactions);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        style={[
          styles.bubbleWrapper,
          isMine ? styles.bubbleRight : styles.bubbleLeft,
          reactions.length > 0 && styles.bubbleWrapperWithReactions,
        ]}
      >
        <View style={styles.bubbleSurfaceWrap}>
          <BubbleTailSvg fill={bubbleBackground} side={isMine ? 'right' : 'left'} />
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: bubbleBackground,
                borderColor: bubbleBorder,
                borderWidth: borderW,
                borderBottomRightRadius: isMine ? 8 : 22,
                borderBottomLeftRadius: isMine ? 22 : 8,
              },
            ]}
          >
            {bubbleBody}
          </View>
          {reactions.length > 0 && (
            <View
              style={[
                styles.reactionsOverlay,
                isMine ? styles.reactionsOverlayMine : styles.reactionsOverlayTheirs,
              ]}
              pointerEvents="none"
              accessibilityElementsHidden={false}
              importantForAccessibility="yes"
              accessibilityRole="text"
              accessibilityLabel={
                'Reactions: ' +
                reactions
                  .map((k) => ReactionIcons.find((x) => x.name === k)?.name ?? k)
                  .join(', ')
              }
            >
              {reactions.map((r: string, i: number) => {
                const icon = ReactionIcons.find((ri) => ri.name === r);
                return icon ? (
                  <View
                    key={`${r}-${i}`}
                    style={[
                      styles.reactionBadge,
                      {
                        borderColor: colors.reactionBadgeBorder,
                        borderWidth: borderW,
                        backgroundColor: colors.reactionBadgeBg,
                      },
                    ]}
                  >
                    <AppSymbol sf={icon.sf as SFSymbol} ion={icon.icon as never} size={13} color={icon.color} />
                  </View>
                ) : (
                  <View
                    key={`${r}-${i}`}
                    style={[
                      styles.reactionBadge,
                      styles.reactionBadgeEmoji,
                      {
                        borderColor: colors.reactionBadgeBorder,
                        borderWidth: borderW,
                        backgroundColor: colors.reactionBadgeBg,
                      },
                    ]}
                  >
                    <Text style={[styles.reactionEmojiText, { color: colors.text }]}>{r}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {showReactions && (
          <Animated.View
            entering={FadeIn}
            style={[
              styles.reactionPickerWrap,
              isMine ? styles.reactionPickerRight : styles.reactionPickerLeft,
            ]}
          >
            <View
              style={[
                styles.reactionPicker,
                {
                  backgroundColor: colors.reactionPickerBg,
                  borderColor: colors.reactionPickerBorder,
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              {ReactionIcons.map((r) => (
                <Pressable
                  key={r.name}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${r.name}`}
                  accessibilityHint={`Adds a ${r.name} reaction to this message`}
                  onPress={() => {
                    onReact(message.id, r.name);
                    setShowReactions(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.reactionButton}
                >
                  <AppSymbol
                    sf={r.sf as SFSymbol}
                    ion={r.icon as never}
                    size={22}
                    color={reactionPickerIconColor(r.name as keyof typeof REACTION_PICKER_ICON_COLORS)}
                  />
                </Pressable>
              ))}
              {isMine && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete message"
                  accessibilityHint="Deletes this message"
                  onPress={() => {
                    onDelete(message.id);
                    setShowReactions(false);
                  }}
                  style={styles.reactionButton}
                >
                  <AppSymbol sf="trash" ion="trash-outline" size={20} color="#991B1B" />
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export type ChatScreenContentProps = {
  /** Glass back control (optional; e.g. modal). */
  onBack?: () => void;
  /** Open attachment flow once (from dashboard quick actions). */
  initialQuickAction?: string | null;
};

export function ChatScreenContent({ onBack, initialQuickAction }: ChatScreenContentProps) {
  const router = useRouter();
  const { colors, scheme } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { reduceMotion, highContrast } = useAccessibilitySettings();

  const { user, token, partner, sharedSecret } = useAuthStore();
  const { messages, isTyping, partnerMood, isPartnerOnline, isConnected, loadMessages } = useChatStore();

  /** iOS: track keyboard for composer inset. Android: avoid KeyboardAvoidingView (leaves phantom padding); use keyboard height on a wrapper instead. */
  const [iosKeyboardOpen, setIosKeyboardOpen] = useState(false);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const show = Keyboard.addListener('keyboardWillShow', () => setIosKeyboardOpen(true));
      const hide = Keyboard.addListener('keyboardWillHide', () => setIosKeyboardOpen(false));
      return () => {
        show.remove();
        hide.remove();
      };
    }
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const composerBottomPadding = Platform.select({
    ios: iosKeyboardOpen ? 10 : Math.max(insets.bottom, 10),
    android: androidKeyboardHeight > 0 ? 8 : Math.max(insets.bottom, 10),
    default: Math.max(insets.bottom, 10),
  })!;

  const {
    sendMessage,
    deleteMsg,
    reactToMessage,
    startTyping,
    stopTyping,
    sendMediaStart,
    sendMediaChunk,
    sendMediaDone,
  } = useSocket(token);

  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null);
  const [fullScreenVideoUri, setFullScreenVideoUri] = useState<string | null>(null);
  const [partnerAvatarFullscreenUri, setPartnerAvatarFullscreenUri] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendScale = useSharedValue(1);
  const quickActionHandled = useRef(false);

  const rows = useMemo(() => buildRows(messages), [messages]);

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: !reduceMotion });
      }, 100);
    }
  }, [messages.length, reduceMotion]);

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      startTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => stopTyping(), 2000);
    } else {
      stopTyping();
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    const msgId = createMessageId();
    const time = new Date().toISOString();

    let payload = text;
    if (sharedSecret) {
      try {
        payload = await encryptMessage(text, sharedSecret);
      } catch {
        payload = text;
      }
    }

    const msg: Message = {
      id: msgId,
      encrypted_payload: payload,
      sender_id: user?.id || '',
      sender_name: user?.name || '',
      time,
      status: 'sending',
      reactions: '[]',
      type: 'text',
      is_deleted: false,
    };

    // Must await so the message exists in state before sendMessage → updateMessageStatus runs.
    await useChatStore.getState().addMessage(msg);
    sendMessage(msgId, payload);
    setInputText('');
    stopTyping();
    sendScale.value = withSpring(1.15, { damping: 12 });
    setTimeout(() => {
      sendScale.value = withSpring(1);
    }, 100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const mediaSend = useMemo(
    () => ({ sendMediaStart, sendMediaChunk, sendMediaDone }),
    [sendMediaStart, sendMediaChunk, sendMediaDone]
  );

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Allow photo library access to share pictures.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.75,
        ...IOS_PHOTO_LIBRARY_OPTIONS,
      });
      if (result.canceled || !result.assets[0]) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const asset = result.assets[0];
      await sendEncryptedMediaAttachment({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        type: 'image',
        fileName: asset.fileName ?? 'photo.jpg',
        sharedSecret,
        user: { id: user?.id || '', name: user?.name || '' },
        ...mediaSend,
      });
    } catch (e) {
      console.warn('[pickImage]', e);
      Alert.alert('Photos', 'Could not open the photo library. Try again.');
    }
  }, [user?.id, user?.name, sharedSecret, mediaSend]);

  const pickVideo = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Videos', 'Allow library access to share videos.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: MAX_VIDEO_PICK_DURATION_SECONDS,
        quality: 0.8,
        ...IOS_VIDEO_LIBRARY_OPTIONS,
      });
      if (result.canceled || !result.assets[0]) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const asset = result.assets[0];
      const durationSec =
        asset.duration != null ? Math.round(asset.duration / 1000) : undefined;
      const rawMime = (asset.mimeType ?? '').toLowerCase();
      let mimeType = rawMime || 'video/mp4';
      if (!rawMime && asset.uri) {
        const u = asset.uri.toLowerCase();
        if (u.includes('.webm')) mimeType = 'video/webm';
        else if (u.includes('.3gp')) mimeType = 'video/3gpp';
      }
      let fileName = asset.fileName ?? 'video.mp4';
      if (!/\.[a-z0-9]+$/i.test(fileName)) {
        fileName =
          mimeType.includes('webm') ? 'video.webm' : mimeType.includes('3gp') ? 'video.3gp' : 'video.mp4';
      }
      await sendEncryptedMediaAttachment({
        uri: asset.uri,
        mimeType,
        type: 'video',
        fileName,
        duration: durationSec,
        sharedSecret,
        user: { id: user?.id || '', name: user?.name || '' },
        ...mediaSend,
      });
    } catch (e) {
      console.warn('[pickVideo]', e);
      const msg = String(e);
      const photosIcloud =
        msg.includes('3164') || msg.includes('PHPhotos') || msg.includes('PHPhotosErrorDomain');
      Alert.alert(
        'Videos',
        photosIcloud
          ? 'This clip may still be loading from iCloud. Use Wi‑Fi, open Photos and wait until the video plays offline, then try again—or pick a video that is already on your device.'
          : 'Could not load that video. Try another clip or try again.'
      );
    }
  }, [user?.id, user?.name, sharedSecret, mediaSend]);

  const pickAudioFile = useCallback(async () => {
    const result = await getDocumentAsync({
      type: ['audio/*', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const asset = result.assets[0];
    await sendEncryptedMediaAttachment({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'audio/mpeg',
      type: 'audio',
      fileName: asset.name || 'audio.m4a',
      sharedSecret,
      user: { id: user?.id || '', name: user?.name || '' },
      ...mediaSend,
    });
  }, [user?.id, user?.name, sharedSecret, mediaSend]);

  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceMaxStopRef = useRef(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const stopVoiceRecordingAndSend = useCallback(async () => {
    const rec = voiceRecordingRef.current;
    voiceRecordingRef.current = null;
    voiceMaxStopRef.current = false;
    setIsRecordingVoice(false);
    if (!rec) return;
    try {
      const finalStatus = await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = rec.getURI() ?? finalStatus.uri ?? null;
      if (!uri) return;
      const durationSec =
        finalStatus.durationMillis != null
          ? Math.round(finalStatus.durationMillis / 1000)
          : undefined;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const u = uri.toLowerCase();
      let mimeType = 'audio/mp4';
      let fileName = 'voice.m4a';
      if (u.includes('.3gp') || u.includes('.amr')) {
        mimeType = 'audio/3gpp';
        fileName = 'voice.3gp';
      } else if (u.includes('.aac')) {
        mimeType = 'audio/aac';
        fileName = 'voice.aac';
      } else if (u.includes('.webm')) {
        mimeType = 'audio/webm';
        fileName = 'voice.webm';
      } else if (u.includes('.caf')) {
        mimeType = 'audio/x-caf';
        fileName = 'voice.caf';
      }
      await sendEncryptedMediaAttachment({
        uri,
        mimeType,
        type: 'audio',
        fileName,
        duration: durationSec,
        sharedSecret,
        user: { id: user?.id || '', name: user?.name || '' },
        ...mediaSend,
      });
    } catch (e) {
      console.warn('[voice]', e);
      Alert.alert('Recording', 'Could not finish voice message.');
    }
  }, [user?.id, user?.name, sharedSecret, mediaSend]);

  const cancelVoiceRecording = useCallback(async () => {
    const rec = voiceRecordingRef.current;
    voiceRecordingRef.current = null;
    voiceMaxStopRef.current = false;
    setIsRecordingVoice(false);
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
    } catch {
      /* ignore */
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (voiceRecordingRef.current != null) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone', 'Allow the microphone to record voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      voiceRecordingRef.current = rec;
      voiceMaxStopRef.current = false;
      rec.setOnRecordingStatusUpdate((st) => {
        if (!st.isRecording || st.durationMillis == null || voiceMaxStopRef.current) return;
        if (st.durationMillis >= MAX_VOICE_RECORD_SECONDS * 1000) {
          voiceMaxStopRef.current = true;
          void stopVoiceRecordingAndSend();
        }
      });
      await rec.startAsync();
      setIsRecordingVoice(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.warn('[voice start]', e);
      Alert.alert(
        'Recording unavailable',
        Platform.OS === 'ios'
          ? 'Voice recording does not work in the iOS Simulator. Try a device.'
          : 'Could not start recording.'
      );
    }
  }, [stopVoiceRecordingAndSend]);

  const openAttachmentMenu = useCallback(() => {
    Alert.alert('Attach', 'Choose a type', [
      { text: 'Photo', onPress: () => void pickImage() },
      { text: 'Video', onPress: () => void pickVideo() },
      { text: 'Audio file', onPress: () => void pickAudioFile() },
      { text: 'Record voice', onPress: () => void startVoiceRecording() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImage, pickVideo, pickAudioFile, startVoiceRecording]);

  useEffect(() => {
    if (!initialQuickAction || quickActionHandled.current) return;
    quickActionHandled.current = true;
    if (initialQuickAction === 'photo') {
      setTimeout(() => void pickImage(), 400);
    }
  }, [initialQuickAction, pickImage]);

  const moodInfo = partnerMood ? MoodIcons[partnerMood] : null;
  const tint: 'light' | 'dark' | 'default' = scheme === 'dark' ? 'dark' : 'light';
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const openImageFullScreen = useCallback((uri: string) => {
    setFullScreenImageUri(uri);
  }, []);

  const openVideoFullScreen = useCallback((uri: string) => {
    setFullScreenVideoUri(uri);
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.rowKind === 'date') {
        return <DateSeparator time={item.time} colors={colors} />;
      }
      return (
        <MessageBubble
          message={item.message}
          isMine={item.message.sender_id === user?.id}
          sharedSecret={sharedSecret}
          onReact={reactToMessage}
          onDelete={deleteMsg}
          onImagePress={openImageFullScreen}
          onVideoPress={openVideoFullScreen}
          colors={colors}
          scheme={scheme}
          highContrast={highContrast}
          fontScale={fontScale}
        />
      );
    },
    [
      user?.id,
      sharedSecret,
      reactToMessage,
      deleteMsg,
      openImageFullScreen,
      openVideoFullScreen,
      colors,
      scheme,
      highContrast,
      fontScale,
    ]
  );

  const renderChatColumn = () => (
    <>
      <FlatList
        ref={flatListRef}
        data={rows}
        renderItem={renderRow}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <BlurView intensity={50} tint={tint} style={[styles.emptyCircle, { borderColor: colors.glassBorder }]}>
              <AppSymbol sf="heart.fill" ion="heart" size={48} color={colors.tint} />
            </BlurView>
            <Text style={[Typography.title3, { color: colors.text, marginTop: 16, textAlign: 'center' }]}>
              Your story starts here
            </Text>
            <Text style={[Typography.callout, { color: colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
              Send your first message to begin your journey together
            </Text>
          </View>
        )}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: !reduceMotion });
          }
        }}
      />

      {isTyping && <TypingIndicatorBubble colors={colors} />}

      {isRecordingVoice && (
        <View
          style={[
            styles.recordingBar,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.glassBorder,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Text style={[Typography.callout, { color: colors.text }]}>Recording voice…</Text>
          <View style={styles.recordingActions}>
            <Pressable onPress={cancelVoiceRecording} style={styles.recordingBtn}>
              <Text style={{ color: colors.textMuted }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => void stopVoiceRecordingAndSend()} style={styles.recordingBtn}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Stop & send</Text>
            </Pressable>
          </View>
        </View>
      )}

      <BlurView
        intensity={isIOS ? 85 : 70}
        tint={tint}
        style={[
          styles.inputArea,
          {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.glassBorder,
            paddingBottom: composerBottomPadding,
          },
        ]}
      >
        <View
          style={[
            styles.composerShell,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Open attachment menu"
            onPress={openAttachmentMenu}
            style={[styles.composerIconButton, { backgroundColor: colors.backgroundSecondary }]}
          >
            <AppSymbol sf="plus" ion="add" size={22} color={colors.tint} />
          </Pressable>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.text,
                  maxHeight: 100,
                  height: Math.max(40, inputHeight),
                  fontSize: Typography.body.fontSize * fontScale,
                },
              ]}
              placeholder="Type a message"
              placeholderTextColor={colors.inputPlaceholder}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              accessibilityLabel="Message input"
              onContentSizeChange={(e) => {
                setInputHeight(e.nativeEvent.contentSize.height);
              }}
            />
          </View>

          <View style={styles.composerTrailing}>
            <Pressable
              accessibilityLabel="Record voice message"
              accessibilityHint="Starts recording a voice message to send"
              accessibilityState={{ disabled: isRecordingVoice }}
              disabled={isRecordingVoice}
              onPress={() => void startVoiceRecording()}
              style={({ pressed }) => [
                styles.inputMicButton,
                { opacity: pressed || isRecordingVoice ? 0.5 : 1 },
              ]}
            >
              <AppSymbol
                sf="mic.fill"
                ion="mic"
                size={22}
                color={isRecordingVoice ? colors.textMuted : colors.tint}
              />
            </Pressable>
            <Animated.View style={sendAnimStyle}>
              <Pressable
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !inputText.trim() }}
                disabled={!inputText.trim()}
                onPress={() => {
                  void handleSend();
                }}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: inputText.trim() ? colors.accent : colors.glassLight,
                    opacity: inputText.trim() ? 1 : 0.75,
                  },
                ]}
              >
                <AppSymbol
                  sf="paperplane.fill"
                  ion="send"
                  size={18}
                  color={inputText.trim() ? colors.textOnPrimary : colors.tint}
                  style={{ marginLeft: 2 }}
                />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </BlurView>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ChatImageFullScreenModal
        uri={fullScreenImageUri}
        visible={!!fullScreenImageUri}
        onClose={() => setFullScreenImageUri(null)}
        topInset={insets.top}
      />
      <ChatVideoFullScreenModal
        uri={fullScreenVideoUri}
        visible={!!fullScreenVideoUri}
        onClose={() => setFullScreenVideoUri(null)}
        topInset={insets.top}
      />
      <AvatarFullScreenModal
        uri={partnerAvatarFullscreenUri}
        visible={!!partnerAvatarFullscreenUri}
        onClose={() => setPartnerAvatarFullscreenUri(null)}
        topInset={insets.top}
      />
      <BlurView
        intensity={80}
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
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (onBack) onBack();
              else router.back();
            }}
            style={[styles.backGlass, { borderColor: colors.glassBorder }]}
          >
            <BlurView intensity={50} tint={tint} style={StyleSheet.absoluteFillObject} />
            <AppSymbol sf="chevron.left" ion="chevron-back" size={20} color={colors.tint} />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.avatarContainer}>
              <Pressable
                disabled={!canDisplayAvatarUri(partner?.avatar)}
                onPress={() => {
                  if (!canDisplayAvatarUri(partner?.avatar)) return;
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPartnerAvatarFullscreenUri(partner!.avatar!);
                }}
                accessibilityRole={canDisplayAvatarUri(partner?.avatar) ? 'button' : 'image'}
                accessibilityLabel={
                  canDisplayAvatarUri(partner?.avatar) ? 'View partner profile photo full screen' : undefined
                }
              >
                <BlurView intensity={45} tint={tint} style={[styles.avatar, { borderColor: colors.glassBorder }]}>
                  {canDisplayAvatarUri(partner?.avatar) ? (
                    <ExpoImage
                      source={{ uri: partner!.avatar! }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <AppSymbol sf="person.fill" ion="person" size={20} color={colors.tint} />
                  )}
                </BlurView>
              </Pressable>
              {isPartnerOnline && (
                <View style={[styles.onlineDot, { backgroundColor: colors.online, borderColor: colors.background }]} />
              )}
            </View>
            <View style={styles.headerText}>
              <View style={styles.nameRow}>
                <Text style={[Typography.headline, { color: colors.text }]} numberOfLines={1}>
                  {partner?.name || 'Partner'}
                </Text>
                {moodInfo && (
                  <AppSymbol sf={moodInfo.sf as SFSymbol} ion={moodInfo.icon as never} size={16} color={moodInfo.color} style={{ marginLeft: 6 }} />
                )}
              </View>
              <Text style={[Typography.caption1, { color: colors.textMuted }]}>
                {isTyping ? 'Typing…' : isPartnerOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={[styles.connDot, { backgroundColor: isConnected ? colors.success : colors.error }]} />
        </View>
      </BlurView>

      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" style={styles.flex} keyboardVerticalOffset={0}>
          {renderChatColumn()}
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, { paddingBottom: androidKeyboardHeight }]}>
          {renderChatColumn()}
        </View>
      )}
    </View>
  );
}

const isIOS = Platform.OS === 'ios';

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  imageViewerRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageViewerHeader: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  imageViewerCloseHit: {
    padding: 4,
  },
  imageViewerGesture: {
    flex: 1,
  },
  imageViewerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  videoModalRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoModalHeader: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  videoModalStage: {
    flex: 1,
    position: 'relative',
  },

  videoBubblePressable: {
    alignSelf: 'stretch',
  },
  videoThumbContainer: {
    position: 'relative',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  videoPlayButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,15,17,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  header: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    gap: 10,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  connDot: { width: 8, height: 8, borderRadius: 4 },

  messageList: {
    paddingHorizontal: 14,
    paddingTop: 10,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bubbleWrapper: {
    marginBottom: 10,
    maxWidth: '84%',
    paddingHorizontal: 4,
    paddingTop: 2,
    overflow: 'visible',
    position: 'relative',
    zIndex: 1,
  },
  /** Space above bubble so tapbacks are not clipped by the previous row / FlatList. */
  bubbleWrapperWithReactions: {
    paddingTop: 16,
    marginTop: 2,
  },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleSurfaceWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  bubble: {
    borderRadius: 24,
    overflow: 'hidden',
    zIndex: 1,
  },
  bubbleInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  bubbleInnerMedia: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  messageText: {
    ...Typography.body,
    lineHeight: 22,
  },
  mediaCardPressable: {
    alignSelf: 'stretch',
    minWidth: 220,
  },
  mediaCard: {
    width: 252,
    maxWidth: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  mediaDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  mediaTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  mediaExpandBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,15,17,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  mediaFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,15,17,0.58)',
  },
  mediaName: {
    ...Typography.footnote,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mediaMeta: {
    ...Typography.caption1,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  messageImage: {
    width: '100%',
    height: 212,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  messageVideo: {
    width: '100%',
    height: 212,
    backgroundColor: '#000',
  },
  uploadProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  uploadProgressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  uploadPercentText: {
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right',
  },
  audioBubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 236,
  },
  audioPlayButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioWaveSection: {
    flex: 1,
    gap: 6,
  },
  audioWaveformRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 30,
  },
  audioWaveBar: {
    width: 4,
    borderRadius: 999,
  },
  audioTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audioTimeText: {
    ...Typography.caption1,
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
  receiptSending: {
    marginLeft: 4,
  },
  receiptSingle: {
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptDouble: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  receiptDoubleLead: {
    marginRight: -6,
  },
  receiptDoubleTrail: {
    marginTop: -1,
  },
  reactionsOverlay: {
    position: 'absolute',
    top: -12,
    zIndex: 50,
    elevation: 50,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: 148,
  },
  /** Tail bottom-right → overlap top-left (iMessage-style). */
  reactionsOverlayMine: {
    left: 2,
  },
  reactionsOverlayTheirs: {
    right: 2,
  },
  reactionBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 4,
  },
  reactionBadgeEmoji: {
    paddingHorizontal: 6,
  },
  reactionEmojiText: {
    fontSize: 14,
    lineHeight: 18,
  },
  reactionPicker: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  reactionPickerWrap: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 10,
    zIndex: 8,
    elevation: 8,
  },
  reactionPickerRight: {
    right: 0,
  },
  reactionPickerLeft: {
    left: 0,
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  typingBubble: {
    position: 'relative',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 0.5,
    overflow: 'visible',
  },
  typingInner: {
    flexDirection: 'row',
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  dateSeparatorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
  },
  dateSeparatorRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateSeparatorPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 0.5,
  },
  dateSeparatorText: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
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

  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  recordingBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  composerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    justifyContent: 'center',
  },
  /** Mic + send — fixed width cluster; no flex growth between mic and send */
  composerTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  /** Same geometry as composerIconButton / sendButton so icons share one baseline */
  inputMicButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    ...Typography.body,
    width: '100%',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 6,
    minHeight: 42,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
