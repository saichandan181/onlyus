import { Alert } from 'react-native';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { splitPayload } from '@/services/mediaTransfer';
import { encryptMessage } from '@/services/encryption';
import type { Message } from '@/services/api';
import { createMessageId } from '@/utils/messageId';
import { useChatStore } from '@/stores/chatStore';
import { getMaxBytesForMediaType, approxBytesFromBase64Length } from '@/constants/mediaLimits';

type MediaEmitters = {
  sendMediaStart: (data: {
    transferId: string;
    totalChunks: number;
    type: string;
    mimeType: string;
    fileName: string;
    duration?: number;
  }) => void;
  sendMediaChunk: (transferId: string, index: number, data: string) => void;
  sendMediaDone: (transferId: string) => void;
};

/**
 * Read file as base64, optional E2E encrypt, chunk and emit (same path as images).
 * Shows per-message upload progress (read → encrypt → chunks).
 */
export async function sendEncryptedMediaAttachment(
  params: {
    uri: string;
    mimeType: string;
    type: Message['type'];
    fileName: string;
    duration?: number;
    sharedSecret: string | null;
    user: { id: string; name: string };
  } & MediaEmitters
): Promise<void> {
  const {
    uri,
    mimeType,
    type,
    fileName,
    duration,
    sharedSecret,
    user,
    sendMediaStart,
    sendMediaChunk,
    sendMediaDone,
  } = params;

  const msgId = createMessageId();
  const setProg = (p: number) =>
    useChatStore.getState().setMessageUploadProgress(msgId, Math.min(1, Math.max(0, p)));

  const msg: Message = {
    id: msgId,
    encrypted_payload: `[${type}]`,
    sender_id: user.id,
    sender_name: user.name,
    time: new Date().toISOString(),
    status: 'sending',
    reactions: '[]',
    type,
    media_uri: uri,
    media_type: mimeType,
    file_name: fileName,
    duration,
    is_deleted: false,
  };

  await useChatStore.getState().addMessage(msg);
  setProg(0.06);

  let base64: string;
  try {
    base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  } catch (e) {
    console.warn('[sendChatMedia] read failed', e);
    useChatStore.getState().removeMessage(msgId);
    useChatStore.getState().clearMessageUploadProgress(msgId);
    Alert.alert(
      'Could not read media',
      'If this item is stored in iCloud, connect to Wi‑Fi and wait for it to download, then try again. You can also pick a different photo or video.'
    );
    return;
  }

  setProg(0.34);

  const max = getMaxBytesForMediaType(type);
  if (approxBytesFromBase64Length(base64.length) > max) {
    useChatStore.getState().removeMessage(msgId);
    useChatStore.getState().clearMessageUploadProgress(msgId);
    Alert.alert(
      'File too large',
      `For ${type}, keep files under about ${Math.round(max / (1024 * 1024))} MB so both phones can send and receive reliably.`
    );
    return;
  }

  let wirePayload = base64;
  if (sharedSecret) {
    try {
      wirePayload = await encryptMessage(base64, sharedSecret);
    } catch (e) {
      console.warn('[sendChatMedia] encrypt failed', e);
    }
  }

  setProg(0.44);

  const chunks = splitPayload(wirePayload);

  sendMediaStart({
    transferId: msgId,
    totalChunks: chunks.length,
    type,
    mimeType,
    fileName,
    duration,
  });
  for (let i = 0; i < chunks.length; i++) {
    sendMediaChunk(msgId, i, chunks[i]);
    setProg(0.44 + ((i + 1) / chunks.length) * 0.56);
  }
  sendMediaDone(msgId);

  const nextStatus = useChatStore.getState().isPartnerOnline ? 'delivered' : 'sent';
  useChatStore.getState().updateMessageStatus(msgId, nextStatus);
  useChatStore.getState().clearMessageUploadProgress(msgId);
}
