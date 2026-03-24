import { useEffect, useMemo, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SOCKET_PAIR_EVENTS } from '@/services/realtimeEvents';
import { normalizeReactionKey } from '@/constants/theme';
import { useChatStore } from '@/stores/chatStore';
import { getSharedSocket, disconnectSharedSocket } from '@/services/socketClient';
import { useAuthStore } from '@/stores/authStore';
import * as Haptics from 'expo-haptics';

/** How many mounted components use useSocket — last one out disconnects the shared client. */
let socketSubscriberCount = 0;

export function useSocket(token: string | null) {
  const socket = useMemo(() => getSharedSocket(token), [token]);

  useEffect(() => {
    if (!socket) return;

    socketSubscriberCount++;
    const isFirstSubscriber = socketSubscriberCount === 1;

    let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

    if (isFirstSubscriber) {
      const handleAppState = (state: AppStateStatus) => {
        if (state === 'active') {
          if (!socket.connected) socket.connect();
          else {
            void useAuthStore.getState().refreshPairStatus();
          }
        }
      };
      appStateSubscription = AppState.addEventListener('change', handleAppState);

      socket.connect();
    } else if (!socket.connected) {
      socket.connect();
    }

    return () => {
      appStateSubscription?.remove();
      socketSubscriberCount--;
      if (socketSubscriberCount <= 0) {
        socketSubscriberCount = 0;
        disconnectSharedSocket();
      }
    };
  }, [socket]);

  const sendMessage = useCallback(
    (id: string, encryptedPayload: string) => {
      if (!socket) return;
      if (!socket.connected) socket.connect();
      socket.emit('msg:text', {
        id,
        encrypted_payload: encryptedPayload,
        time: new Date().toISOString(),
      });
      const nextStatus = useChatStore.getState().isPartnerOnline ? 'delivered' : 'sent';
      useChatStore.getState().updateMessageStatus(id, nextStatus);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [socket]
  );

  const deleteMsg = useCallback(
    (msgId: string) => {
      if (!socket) return;
      if (!socket.connected) socket.connect();
      socket.emit('msg:delete', {
        msgId,
        time: new Date().toISOString(),
      });
    },
    [socket]
  );

  const reactToMessage = useCallback(
    (msgId: string, reaction: string) => {
      if (!socket) return;
      if (!socket.connected) socket.connect();
      socket.emit('msg:react', {
        msgId,
        emoji: reaction,
        time: new Date().toISOString(),
      });
      // Relay skips the sender on msg:reaction — update local state so our reaction shows immediately.
      useChatStore.getState().addReactionToMessage(msgId, normalizeReactionKey(reaction));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [socket]
  );

  const startTyping = useCallback(() => {
    socket?.emit('typing:start', {});
  }, [socket]);

  const stopTyping = useCallback(() => {
    socket?.emit('typing:stop', {});
  }, [socket]);

  const updateMoodEncrypted = useCallback(
    (encryptedPayload: string) => {
      if (!socket) return;
      if (!socket.connected) socket.connect();
      socket.emit('mood:update', {
        encrypted_payload: encryptedPayload,
        time: new Date().toISOString(),
      });
    },
    [socket]
  );

  const emitAnniversaryEncrypted = useCallback(
    (encryptedPayload: string) => {
      if (!socket) return;
      if (!socket.connected) socket.connect();
      socket.emit(SOCKET_PAIR_EVENTS.ANNIVERSARY_UPDATE, {
        encrypted_payload: encryptedPayload,
        time: new Date().toISOString(),
      });
    },
    [socket]
  );

  const sendMediaStart = useCallback(
    (data: {
      transferId: string;
      totalChunks: number;
      type: string;
      mimeType: string;
      fileName: string;
      duration?: number;
      caption?: string;
    }) => {
      if (!socket) return;
      if (!socket.connected) socket.connect();
      socket.emit('media:start', {
        ...data,
        time: new Date().toISOString(),
      });
    },
    [socket]
  );

  const sendMediaChunk = useCallback(
    (transferId: string, index: number, data: string) => {
      if (!socket) return;
      if (!socket.connected) socket.connect();
      socket.emit('media:chunk', { transferId, index, data });
    },
    [socket]
  );

  const sendMediaDone = useCallback(
    (transferId: string) => {
      if (!socket) return;
      if (!socket.connected) socket.connect();
      socket.emit('media:done', {
        transferId,
        time: new Date().toISOString(),
      });
    },
    [socket]
  );

  const requestMediaResend = useCallback(
    (transferId: string) => {
      socket?.emit('media:request', { transferId });
    },
    [socket]
  );

  const debugRooms = useCallback(() => {
    socket?.emit('debug:rooms', {});
  }, [socket]);

  return {
    socket,
    isConnected: socket?.connected || false,
    sendMessage,
    deleteMsg,
    reactToMessage,
    startTyping,
    stopTyping,
    updateMoodEncrypted,
    emitAnniversaryEncrypted,
    sendMediaStart,
    sendMediaChunk,
    sendMediaDone,
    requestMediaResend,
    debugRooms,
  };
}
