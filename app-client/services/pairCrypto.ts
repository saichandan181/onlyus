import { decryptMessage, encryptMessage } from '@/services/encryption';

/** Wire format: JSON encrypted with the same shared secret as chat messages. */
export type AnniversaryPayload = { v: 1; kind: 'anniversary'; iso: string };
export type MoodPayload = { v: 1; kind: 'mood'; mood: string };

export async function encryptAnniversary(isoDate: string, secret: string): Promise<string> {
  const payload: AnniversaryPayload = { v: 1, kind: 'anniversary', iso: isoDate };
  return encryptMessage(JSON.stringify(payload), secret);
}

export async function decryptAnniversary(
  ciphertext: string | null | undefined,
  secret: string | null
): Promise<string | null> {
  if (!ciphertext || !secret) return null;
  try {
    const raw = await decryptMessage(ciphertext, secret);
    const p = JSON.parse(raw) as AnniversaryPayload;
    if (p.kind === 'anniversary' && typeof p.iso === 'string') return p.iso;
  } catch {
    /* ignore */
  }
  return null;
}

export async function encryptMood(mood: string, secret: string): Promise<string> {
  const payload: MoodPayload = { v: 1, kind: 'mood', mood };
  return encryptMessage(JSON.stringify(payload), secret);
}

export async function decryptMood(
  ciphertext: string | null | undefined,
  secret: string | null
): Promise<string | null> {
  if (!ciphertext || !secret) return null;
  try {
    const raw = await decryptMessage(ciphertext, secret);
    const p = JSON.parse(raw) as MoodPayload;
    if (p.kind === 'mood' && typeof p.mood === 'string') return p.mood;
  } catch {
    /* ignore */
  }
  return null;
}
