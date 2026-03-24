import type { Message } from '@/services/api';

/**
 * Soft caps before we read/base64-encode the whole file (memory + transfer time).
 * The relay streams chunks and does not persist media; limits protect the devices.
 */
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Voice note max length (recording auto-stops at this cap). */
export const MAX_VOICE_RECORD_SECONDS = 10 * 60;

/** Library video pick — max duration passed to the system picker (seconds). */
export const MAX_VIDEO_PICK_DURATION_SECONDS = 30 * 60;

export function getMaxBytesForMediaType(t: Message['type']): number {
  switch (t) {
    case 'video':
      return MAX_VIDEO_BYTES;
    case 'audio':
      return MAX_AUDIO_BYTES;
    case 'image':
      return MAX_IMAGE_BYTES;
    default:
      return MAX_IMAGE_BYTES;
  }
}

/** Approximate decoded size from base64 length (avoids loading huge files twice). */
export function approxBytesFromBase64Length(b64Length: number): number {
  return Math.floor((b64Length * 3) / 4);
}
