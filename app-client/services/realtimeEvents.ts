/**
 * Mood & anniversary — Socket.IO only (no REST `/mood` or `/anniversary` routes).
 * Encrypt/decrypt via `pairCrypto` + pair shared secret; relay in `relay.py`.
 *
 * @see API_DOCUMENTATION.md — "Mood & anniversary (E2E — Socket.IO only, no REST)"
 */

export type { MoodPayload, AnniversaryPayload } from '@/services/pairCrypto';

/** Emitted and received on the wire for `mood:update` and `anniversary:update`. */
export type BlindedRelayPayload = {
  encrypted_payload: string;
  time?: string;
};

/** Socket.IO event names (pair room, JWT auth on connect). */
export const SOCKET_PAIR_EVENTS = {
  MOOD_UPDATE: 'mood:update',
  ANNIVERSARY_UPDATE: 'anniversary:update',
} as const;
