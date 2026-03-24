import { writeAsStringAsync, cacheDirectory, EncodingType } from 'expo-file-system/legacy';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { decryptMessage } from '@/services/encryption';
import type { Message } from '@/services/api';

type Buf = {
  totalChunks: number;
  parts: string[];
  mimeType: string;
  mediaKind: Message['type'];
  fileName?: string;
};

const buffers = new Map<string, Buf>();

/** Call when unpairing so partial transfers cannot merge into state later. */
export function clearIncomingMediaBuffers(): void {
  buffers.clear();
}

function extensionFromMimeAndName(mime: string, fileName?: string): string {
  const fromName = fileName?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (fromName && fromName.length <= 6) return `.${fromName}`;

  const m = mime.toLowerCase().split(';')[0].trim();
  if (m === 'video/mp4' || m === 'video/quicktime') return '.mp4';
  if (m === 'video/3gpp' || m === 'video/3gp') return '.3gp';
  if (m === 'video/webm') return '.webm';
  if (m === 'audio/mp4' || m === 'audio/m4a' || m === 'audio/x-m4a') return '.m4a';
  if (m === 'audio/mpeg' || m === 'audio/mp3') return '.mp3';
  if (m === 'audio/aac') return '.aac';
  if (m === 'audio/3gpp' || m === 'audio/amr' || m === 'audio/3gp') return '.3gp';
  if (m === 'audio/wav' || m === 'audio/x-wav') return '.wav';
  if (m === 'audio/webm') return '.webm';
  if (m === 'image/jpeg') return '.jpg';
  if (m === 'image/png') return '.png';
  if (m === 'image/webp') return '.webp';
  return '';
}

/** iOS AVPlayer / expo-av handle file:// with a real extension better than huge data: URIs. */
function normalizeMimeForIosPlayback(mime: string, kind: Message['type']): string {
  const m = mime.toLowerCase().split(';')[0].trim();
  if (kind === 'audio' && (m === 'audio/m4a' || m === '')) return 'audio/mp4';
  return m || (kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/mp4' : 'image/jpeg');
}

export function initIncomingMedia(data: {
  transferId: string;
  totalChunks: number;
  mimeType?: string;
  mediaKind?: Message['type'];
  fileName?: string;
}): void {
  const n = Math.max(1, data.totalChunks);
  buffers.set(data.transferId, {
    totalChunks: n,
    parts: new Array(n).fill(''),
    mimeType: data.mimeType || 'image/jpeg',
    mediaKind: data.mediaKind || 'image',
    fileName: data.fileName,
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
  const playbackMime = normalizeMimeForIosPlayback(mime, kind);

  let mediaUri: string;
  if (kind === 'video' || kind === 'audio') {
    const base = cacheDirectory;
    if (!base) {
      mediaUri = `data:${playbackMime};base64,${assembled}`;
    } else {
      const ext = extensionFromMimeAndName(mime, b.fileName) || (kind === 'video' ? '.mp4' : '.m4a');
      const safeId = transferId.replace(/[^a-z0-9_-]/gi, '_');
      const path = `${base}onlyus_media_${safeId}${ext}`;
      try {
        await writeAsStringAsync(path, assembled, { encoding: EncodingType.Base64 });
        mediaUri = path.startsWith('file://') ? path : `file://${path}`;
      } catch (e) {
        console.warn('[media] cache write failed, falling back to data URI', e);
        mediaUri = `data:${playbackMime};base64,${assembled}`;
      }
    }
  } else {
    mediaUri = `data:${playbackMime};base64,${assembled}`;
  }

  useChatStore.getState().mergeMessage(transferId, {
    media_uri: mediaUri,
    encrypted_payload: `[${kind}]`,
    type: kind,
    media_type: playbackMime,
  });
}
