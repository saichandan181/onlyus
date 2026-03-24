import { useAuthStore } from '@/stores/authStore';
import { derivePairSharedSecret } from '@/services/encryption';

/**
 * Returns the in-memory shared secret, or derives the pair key from both users' public keys.
 * Use before decrypting E2E payloads when events may arrive before refreshPairStatus finishes.
 */
export async function ensureSharedSecret(): Promise<string | null> {
  const existing = useAuthStore.getState().sharedSecret;
  if (existing) return existing;

  const partner = useAuthStore.getState().partner;
  const user = useAuthStore.getState().user;
  if (!partner?.public_key || !user?.public_key) return null;

  const secret = await derivePairSharedSecret(user.public_key, partner.public_key);
  useAuthStore.getState().setSharedSecret(secret);
  return secret;
}
