import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  useWindowDimensions,
  Image,
  Modal,
  Alert,
} from 'react-native';
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
import { Audio, Video, ResizeMode } from 'expo-av';
import type { SFSymbol } from 'sf-symbols-typescript';
import { createMessageId } from '@/utils/messageId';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccessibilitySettings } from '@/hooks/use-accessibility-settings';
import { Colors, Typography, BorderRadius, MoodIcons, ReactionIcons } from '@/constants/theme';
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

const TIMESTAMP_GAP_MS = 5 * 60 * 1000;

type ListRow =
  | { rowKind: 'timestamp'; id: string; time: string }
  | { rowKind: 'message'; id: string; message: Message };

function buildRows(messages: Message[]): ListRow[] {
  const out: ListRow[] = [];
  let last = 0;
  for (const m of messages) {
    const t = new Date(m.time).getTime();
    if (out.length === 0 || t - last > TIMESTAMP_GAP_MS) {
      out.push({ rowKind: 'timestamp', id: `ts-${m.id}`, time: m.time });
      last = t;
    }
    out.push({ rowKind: 'message', id: m.id, message: m });
  }
  return out;
}

function GlassTypingDots({ colors }: { colors: (typeof Colors)['light'] }) {
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
  }, []);

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View style={styles.typingContainer}>
      <BlurView intensity={55} tint="default" style={[styles.typingGlass, { borderColor: colors.glassBorder }]}>
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.textMuted }, s1]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.textMuted }, s2]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: colors.textMuted }, s3]} />
      </BlurView>
    </View>
  );
}

function TimestampPill({ time, colors }: { time: string; colors: (typeof Colors)['light'] }) {
  const d = new Date(time);
  const label = d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <View style={styles.timestampWrap}>
      <BlurView intensity={40} tint="default" style={[styles.timestampPill, { borderColor: colors.glassBorder }]}>
        <Text style={[Typography.caption2, { color: colors.textMuted }]}>{label}</Text>
      </BlurView>
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
  }, [visible]);

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

        <GestureDetector style={styles.imageViewerGesture} gesture={pinch}>
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
}: {
  uri: string;
  colors: (typeof Colors)['light'];
  isMine: boolean;
  fontScale: number;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const toggle = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlaying(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
      });
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && 'didJustFinish' in st && st.didJustFinish) {
          setPlaying(false);
        }
      });
      await sound.playAsync();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn('[ChatAudioBubble]', e);
    }
  };

  const playIconColor = isMine ? colors.myBubbleText : colors.text;
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
      style={styles.audioBubbleRow}
    >
      <AppSymbol
        sf={playing ? 'pause.circle.fill' : 'play.circle.fill'}
        ion={playing ? 'pause-circle' : 'play-circle'}
        size={36 * fontScale}
        color={playIconColor}
      />
      <Text
        style={[
          styles.messageText,
          {
            color: isMine ? colors.myBubbleText : colors.partnerBubbleText,
            fontSize: Typography.body.fontSize * fontScale,
          },
        ]}
      >
        Voice / audio
      </Text>
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
  colors: (typeof Colors)['light'];
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

  const reactions = (() => {
    try {
      return JSON.parse(message.reactions);
    } catch {
      return [];
    }
  })();

  const formatTime = (t: string) => {
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const statusSf = (): SFSymbol => {
    switch (message.status) {
      case 'sending':
        return 'clock';
      case 'sent':
        return 'checkmark';
      case 'delivered':
        return 'checkmark.circle';
      case 'read':
        return 'checkmark.circle.fill';
      default:
        return 'checkmark';
    }
  };

  const tint: 'light' | 'dark' | 'default' = scheme === 'dark' ? 'dark' : 'light';
  /** Peach overlay + blur washes out light coral; keep for dark glass only. */
  const coralTint = isMine && scheme === 'dark' ? 'rgba(255, 131, 96, 0.35)' : undefined;
  const borderW = highContrast ? 1 : 0.5;

  const bubbleShellStyle = [
    styles.bubble,
    {
      borderWidth: borderW,
      borderColor: isMine
        ? scheme === 'light'
          ? highContrast
            ? '#000000'
            : colors.myBubble
          : colors.accent + (highContrast ? 'CC' : '66')
        : scheme === 'light'
          ? colors.partnerBubbleBorder
          : colors.glassBorder,
      overflow: 'hidden' as const,
      borderBottomRightRadius: isMine ? 4 : BorderRadius.lg,
      borderBottomLeftRadius: isMine ? BorderRadius.lg : 4,
      ...(scheme === 'light' && {
        backgroundColor: isMine ? colors.myBubble : colors.partnerBubble,
      }),
    },
  ];

  const bubbleBody = (
    <>
      {coralTint ? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: coralTint }]} /> : null}
      <View style={styles.bubbleInner}>
            {message.type === 'image' && message.media_uri ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="View image full screen"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onImagePress?.(message.media_uri!);
                }}
              >
                <Image
                  source={{ uri: message.media_uri }}
                  style={[styles.messageImage, { maxHeight: 220 * fontScale }]}
                  resizeMode="cover"
                  accessibilityLabel="Shared image"
                />
              </Pressable>
            ) : message.type === 'video' && message.media_uri ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play video"
                accessibilityHint="Opens full screen video with controls"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onVideoPress?.(message.media_uri!);
                }}
                style={styles.videoBubblePressable}
              >
                <View style={styles.videoThumbContainer}>
                  <Video
                    source={{ uri: message.media_uri }}
                    style={[styles.messageVideo, { maxHeight: 240 * fontScale }]}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted
                    useNativeControls={false}
                    isLooping={false}
                  />
                  <View style={styles.videoPlayOverlay} pointerEvents="none">
                    <AppSymbol
                      sf="play.circle.fill"
                      ion="play-circle"
                      size={Math.min(56, 48 * fontScale)}
                      color="rgba(255,255,255,0.95)"
                    />
                  </View>
                </View>
              </Pressable>
            ) : message.type === 'audio' && message.media_uri ? (
              <ChatAudioBubble uri={message.media_uri} colors={colors} isMine={isMine} fontScale={fontScale} />
            ) : message.type === 'image' || message.type === 'video' || message.type === 'audio' ? (
              <Text
                style={[
                  styles.messageText,
                  {
                    color: isMine ? colors.myBubbleText : colors.partnerBubbleText,
                    fontSize: Typography.body.fontSize * fontScale,
                    fontStyle: 'italic',
                  },
                ]}
              >
                Receiving media…
              </Text>
            ) : (
              <Text
                style={[
                  styles.messageText,
                  {
                    color: isMine ? colors.myBubbleText : colors.partnerBubbleText,
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
                      backgroundColor: isMine ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.1)',
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
                      color: isMine ? colors.myBubbleMuted : colors.textMuted,
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
                    color: isMine ? colors.myBubbleMuted : colors.textMuted,
                    fontSize: 11 * fontScale,
                  },
                ]}
              >
                {formatTime(message.time)}
              </Text>
              {isMine && (
                <AppSymbol
                  sf={statusSf()}
                  ion={
                    message.status === 'sending'
                      ? 'time-outline'
                      : message.status === 'delivered'
                        ? 'checkmark-circle-outline'
                        : message.status === 'read'
                          ? 'checkmark-done'
                          : 'checkmark'
                  }
                  size={12 * fontScale}
                  color={message.status === 'read' ? colors.myBubbleText : colors.myBubbleMuted}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
    </>
  );

  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} style={[animStyle]}>
      <Pressable
        accessibilityLabel="Message"
        accessibilityHint="Long press for reactions"
        onLongPress={() => {
          setShowReactions(!showReactions);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        style={[styles.bubbleWrapper, isMine ? styles.bubbleRight : styles.bubbleLeft]}
      >
        {scheme === 'light' ? (
          <View style={bubbleShellStyle}>{bubbleBody}</View>
        ) : (
          <BlurView intensity={isMine ? 70 : 55} tint={tint} style={bubbleShellStyle}>
            {bubbleBody}
          </BlurView>
        )}

        {reactions.length > 0 && (
          <View style={[styles.reactionsDisplay, isMine ? styles.reactionsRight : styles.reactionsLeft]}>
            {reactions.map((r: string, i: number) => {
              const icon = ReactionIcons.find((ri) => ri.name === r);
              return icon ? (
                <BlurView
                  key={i}
                  intensity={50}
                  tint={tint}
                  style={[styles.reactionBadge, { borderColor: colors.glassBorder, borderWidth: borderW }]}
                >
                  <AppSymbol sf={icon.sf as SFSymbol} ion={icon.icon as never} size={12} color={icon.color} />
                </BlurView>
              ) : null;
            })}
          </View>
        )}

        {showReactions && (
          <Animated.View entering={FadeIn}>
            <BlurView intensity={60} tint={tint} style={[styles.reactionPicker, { borderColor: colors.glassBorder }]}>
              {ReactionIcons.map((r) => (
                <Pressable
                  key={r.name}
                  accessibilityLabel={`React with ${r.name}`}
                  onPress={() => {
                    onReact(message.id, r.name);
                    setShowReactions(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.reactionButton}
                >
                  <AppSymbol sf={r.sf as SFSymbol} ion={r.icon as never} size={22} color={r.color} />
                </Pressable>
              ))}
              {isMine && (
                <Pressable
                  accessibilityLabel="Delete message"
                  onPress={() => {
                    onDelete(message.id);
                    setShowReactions(false);
                  }}
                  style={styles.reactionButton}
                >
                  <AppSymbol sf="trash" ion="trash-outline" size={20} color={colors.error} />
                </Pressable>
              )}
            </BlurView>
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
  const colorScheme = useColorScheme() ?? 'dark';
  const scheme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { reduceMotion, highContrast } = useAccessibilitySettings();

  const { user, token, partner, sharedSecret } = useAuthStore();
  const { messages, isTyping, partnerMood, isPartnerOnline, isConnected, loadMessages } = useChatStore();

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
      await sendEncryptedMediaAttachment({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'video/mp4',
        type: 'video',
        fileName: asset.fileName ?? 'video.mp4',
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
      await sendEncryptedMediaAttachment({
        uri,
        mimeType: 'audio/m4a',
        type: 'audio',
        fileName: 'voice.m4a',
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
      if (item.rowKind === 'timestamp') {
        return <TimestampPill time={item.time} colors={colors} />;
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
              <BlurView intensity={45} tint={tint} style={[styles.avatar, { borderColor: colors.glassBorder }]}>
                <AppSymbol sf="person.fill" ion="person" size={20} color={colors.tint} />
              </BlurView>
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={rows}
          renderItem={renderRow}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.messageList, { paddingBottom: 8 }]}
          showsVerticalScrollIndicator={false}
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

        {isTyping && <GlassTypingDots colors={colors} />}

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
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Attach photo, video, or audio"
            onPress={openAttachmentMenu}
            style={styles.attachButton}
          >
            <AppSymbol sf="paperclip" ion="attach" size={24} color={colors.tint} />
          </Pressable>

          <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
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
              placeholder="Message"
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              accessibilityLabel="Message input"
              onContentSizeChange={(e) => {
                setInputHeight(e.nativeEvent.contentSize.height);
              }}
            />
          </View>

          <Animated.View style={sendAnimStyle}>
            <Pressable
              accessibilityLabel={inputText.trim() ? 'Send message' : 'Record voice message'}
              onPress={() => {
                if (inputText.trim()) {
                  void handleSend();
                } else {
                  void startVoiceRecording();
                }
              }}
              style={[
                styles.sendButton,
                {
                  backgroundColor: inputText.trim() ? colors.accent : colors.glassLight,
                },
              ]}
            >
              <AppSymbol
                sf={inputText.trim() ? 'arrow.up.circle.fill' : 'mic.fill'}
                ion={inputText.trim() ? 'send' : 'mic'}
                size={22}
                color={inputText.trim() ? colors.textOnPrimary : colors.tint}
              />
            </Pressable>
          </Animated.View>
        </BlurView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
    paddingTop: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bubbleWrapper: {
    marginBottom: 12,
    maxWidth: '78%',
  },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: BorderRadius.lg,
  },
  bubbleInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageText: {
    ...Typography.body,
    lineHeight: 22,
  },
  messageImage: {
    width: '100%',
    minHeight: 140,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  messageVideo: {
    width: '100%',
    minHeight: 160,
    borderRadius: BorderRadius.md,
    backgroundColor: '#000',
    overflow: 'hidden',
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
    gap: 10,
    minWidth: 200,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
  },
  reactionsDisplay: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  reactionsRight: { justifyContent: 'flex-end' },
  reactionsLeft: { justifyContent: 'flex-start' },
  reactionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reactionPicker: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  reactionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  typingGlass: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    gap: 5,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  timestampWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  timestampPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    borderWidth: 0.5,
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    borderWidth: 0.5,
    paddingHorizontal: 14,
  },
  textInput: {
    ...Typography.body,
    paddingVertical: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
