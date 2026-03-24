import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { decryptMessage } from '@/services/encryption';
import type { Message } from '@/services/api';

type Buf = {
  totalChunks: number;
  parts: string[];
  mimeType: string;
  mediaKind: Message['type'];
};

const buffers = new Map<string, Buf>();

export function initIncomingMedia(data: {
  transferId: string;
  totalChunks: number;
  mimeType?: string;
  mediaKind?: Message['type'];
}): void {
  const n = Math.max(1, data.totalChunks);
  buffers.set(data.transferId, {
    totalChunks: n,
    parts: new Array(n).fill(''),
    mimeType: data.mimeType || 'image/jpeg',
    mediaKind: data.mediaKind || 'image',
  });
}

export function pushIncomingChunk(transferId: string, index: number, data: string): void {
  const b = buffers.get(transferId);
  if (!b || index < 0 || index >= b.totalChunks) return;
  b.parts[index] = data;
}

export async function finalizeIncomingMedia(transferId: string): Promise<void> {
  const b = buffers.get(transferId);
  buffers.delete(transferId);
  if (!b) return;

  if (b.parts.some((p) => p === '')) {
    console.warn('[media] incomplete chunks for', transferId);
    return;
  }

  let assembled = b.parts.join('');
  const secret = useAuthStore.getState().sharedSecret;

  if (secret && assembled.includes(':')) {
    try {
      assembled = await decryptMessage(assembled, secret);
    } catch (e) {
      console.warn('[media] decrypt failed', e);
      return;
    }
  }

  const mime = b.mimeType || 'image/jpeg';
  const kind = b.mediaKind;
  const dataUri = `data:${mime};base64,${assembled}`;
  useChatStore.getState().mergeMessage(transferId, {
    media_uri: dataUri,
    encrypted_payload: `[${kind}]`,
    type: kind,
    media_type: mime,
  });
}
