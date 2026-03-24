import type { Socket } from 'socket.io-client';
import * as Haptics from 'expo-haptics';
import { SOCKET_PAIR_EVENTS, type BlindedRelayPayload } from '@/services/realtimeEvents';
import { normalizeReactionKey } from '@/constants/theme';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { usePairLocalStore } from '@/stores/pairLocalStore';
import { decryptAnniversary, decryptMood, encryptAnniversary, encryptMood } from '@/services/pairCrypto';
import { ensureSharedSecret } from '@/services/sharedSecret';
import { Message } from '@/services/api';
import {
  initIncomingMedia,
  pushIncomingChunk,
  finalizeIncomingMedia,
} from '@/services/mediaIncomingBuffer';

/** Compare user ids from API vs relay (UUID formatting may differ). */
function sameUserId(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  return a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase();
}

/**
 * Attach all Socket.IO listeners once per socket instance (called from getSharedSocket).
 * Ensures mood/anniversary/chat work even if the first mounted screen is not Chat.
 */
export function attachSocketListeners(socket: Socket): void {
  const {
    addMessage,
    removeMessage,
    addReactionToMessage,
    setTyping,
    setPartnerMood,
    setPartnerOnline,
    setConnected,
  } = useChatStore.getState();
  const { setPartnerOnline: setAuthPartnerOnline } = useAuthStore.getState();

  socket.on('connect', async () => {
    setConnected(true);
    void useAuthStore.getState().refreshPairStatus();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await usePairLocalStore.getState().hydrate();
      const secret = await ensureSharedSecret();
      if (!secret) return;
      const { myMoodKey, anniversaryIso } = usePairLocalStore.getState();
      const time = new Date().toISOString();
      if (myMoodKey) {
        const enc = await encryptMood(myMoodKey, secret);
        socket.emit(SOCKET_PAIR_EVENTS.MOOD_UPDATE, { encrypted_payload: enc, time });
      }
      if (anniversaryIso) {
        const enc = await encryptAnniversary(anniversaryIso, secret);
        socket.emit(SOCKET_PAIR_EVENTS.ANNIVERSARY_UPDATE, { encrypted_payload: enc, time });
      }
    } catch (e) {
      console.warn('[socket] pair state resync on connect failed', e);
    }
  });

  socket.on('disconnect', () => {
    setConnected(false);
  });

  socket.on('error', (data: { error: string; message?: string }) => {
    console.error('Socket error:', data);
  });

  socket.on('partner:status', (data: { online: boolean }) => {
    setPartnerOnline(data.online);
    setAuthPartnerOnline(data.online);
  });

  socket.on(
    'partner:online',
    (data?: { name?: string; avatar?: string | null }) => {
      setPartnerOnline(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const p = useAuthStore.getState().partner;
      if (p) {
        useAuthStore.setState({
          partner: {
            ...p,
            is_online: true,
            ...(data?.name !== undefined ? { name: data.name } : {}),
            ...(data?.avatar !== undefined ? { avatar: data.avatar } : {}),
          },
        });
      } else {
        setAuthPartnerOnline(true);
      }
    }
  );

  /** Partner changed name/avatar on the server — refetch so we have the latest profile fields. */
  socket.on('partner:profile_updated', () => {
    void useAuthStore.getState().refreshPairStatus();
  });

  socket.on('partner:offline', () => {
    setPartnerOnline(false);
    setAuthPartnerOnline(false);
  });

  socket.on(
    'msg:new',
    (data: {
      id: string;
      encrypted_payload: string;
      time: string;
      sender: { id: string; name: string };
    }) => {
      const msg: Message = {
        id: data.id,
        encrypted_payload: data.encrypted_payload,
        sender_id: data.sender.id,
        sender_name: data.sender.name,
        time: data.time,
        status: 'delivered',
        reactions: '[]',
        type: 'text',
        is_deleted: false,
      };
      addMessage(msg);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  );

  socket.on('msg:deleted', (data: { msgId: string }) => {
    removeMessage(data.msgId);
  });

  socket.on('msg:reaction', (data: { msgId: string; emoji: string }) => {
    addReactionToMessage(data.msgId, normalizeReactionKey(data.emoji));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });

  socket.on('typing:start', (data?: { from_user_id?: string }) => {
    const me = useAuthStore.getState().user?.id;
    const partnerId = useAuthStore.getState().partner?.id;
    const from = data?.from_user_id;
    if (!from || !partnerId) return;
    if (sameUserId(from, me)) return;
    if (!sameUserId(from, partnerId)) return;
    setTyping(true);
  });

  socket.on('typing:stop', (data?: { from_user_id?: string }) => {
    const me = useAuthStore.getState().user?.id;
    const partnerId = useAuthStore.getState().partner?.id;
    const from = data?.from_user_id;
    if (!from || !partnerId) return;
    if (sameUserId(from, me)) return;
    if (!sameUserId(from, partnerId)) return;
    setTyping(false);
  });

  socket.on(SOCKET_PAIR_EVENTS.MOOD_UPDATE, async (data: BlindedRelayPayload) => {
    const secret = await ensureSharedSecret();
    if (!secret || !data.encrypted_payload) return;
    const mood = await decryptMood(data.encrypted_payload, secret);
    if (mood != null) setPartnerMood(mood);
  });

  socket.on(SOCKET_PAIR_EVENTS.ANNIVERSARY_UPDATE, async (data: BlindedRelayPayload) => {
    const secret = await ensureSharedSecret();
    if (!secret || !data.encrypted_payload) return;
    const iso = await decryptAnniversary(data.encrypted_payload, secret);
    if (iso) await usePairLocalStore.getState().setAnniversaryIso(iso);
  });

  socket.on(
    'media:incoming',
    (data: {
      transferId: string;
      totalChunks: number;
      type?: string;
      mimeType?: string;
      fileName?: string;
      caption?: string;
      duration?: number;
      sender?: { id: string; name: string };
    }) => {
      initIncomingMedia({
        transferId: data.transferId,
        totalChunks: data.totalChunks,
        mimeType: data.mimeType,
        mediaKind: (data.type || 'image') as Message['type'],
        fileName: data.fileName,
      });
      const msg: Message = {
        id: data.transferId,
        encrypted_payload: data.caption || '…',
        sender_id: data.sender?.id || '',
        sender_name: data.sender?.name || '',
        time: new Date().toISOString(),
        status: 'delivered',
        reactions: '[]',
        type: (data.type || 'image') as Message['type'],
        media_type: data.mimeType,
        file_name: data.fileName,
        caption: data.caption,
        duration: data.duration,
        is_deleted: false,
      };
      addMessage(msg);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  );

  socket.on('media:chunk', (data: { transferId: string; index: number; data: string }) => {
    pushIncomingChunk(data.transferId, data.index, data.data);
  });

  socket.on('media:complete', (data: { transferId: string }) => {
    void finalizeIncomingMedia(data.transferId).then(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  });

  socket.on('media:progress', (data: { transferId: string; progress: number }) => {
    console.log('Media upload progress:', data.progress);
  });

  socket.on('media:pending', (data: unknown[]) => {
    console.log('Pending media transfers:', data.length);
  });

  socket.on('media:resend_request', (data: { transferId: string }) => {
    console.log('Partner requested media resend:', data.transferId);
  });

  socket.on('media:unavailable', (data: { transferId: string; reason: string }) => {
    console.log('Media unavailable:', data.transferId, data.reason);
  });

  socket.on('debug:response', (data: unknown) => {
    console.log('Debug info:', data);
  });
}
