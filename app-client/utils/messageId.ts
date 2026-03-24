/**
 * Message IDs without expo-crypto (avoids ExpoCryptoAES native module in Expo Go when
 * expo-crypto JS version mismatches the client).
 */
export function createMessageId(): string {
  const prefix = `msg-${Date.now()}-`;
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return prefix + c.randomUUID();
  }
  return (
    prefix +
    Math.random().toString(36).slice(2, 11) +
    Math.random().toString(36).slice(2, 11)
  );
}
