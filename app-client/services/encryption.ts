// Custom crypto implementation for Expo Go compatibility
// Uses Web Crypto API which is available in React Native

async function getRandomBytes(length: number): Promise<Uint8Array> {
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback to Math.random (less secure, but works)
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return array;
}

async function sha256(text: string): Promise<string> {
  // Use Web Crypto API if available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback: simple hash (not cryptographically secure)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const privateBytes = await getRandomBytes(32);
  const privateKey = Array.from(privateBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Derive "public key" via hash (simplified)
  const publicKey = await sha256(privateKey);

  return { publicKey, privateKey };
}

/**
 * Identical on both devices: hash(sorted(pubMine, pubPartner)).
 * Required so XOR encrypt/decrypt matches for chat, mood, and anniversary relay.
 * (A hash of privateKey+partnerPublic differs per side and breaks partner decrypt.)
 */
export async function derivePairSharedSecret(
  myPublicKey: string,
  partnerPublicKey: string
): Promise<string> {
  const a = myPublicKey.trim();
  const b = partnerPublicKey.trim();
  const combined =
    a.toLowerCase() < b.toLowerCase() ? a + b : b + a;
  return sha256(combined);
}

export async function encryptMessage(text: string, sharedSecret: string): Promise<string> {
  // Generate random IV
  const ivBytes = await getRandomBytes(16);
  const iv = Array.from(ivBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // XOR-based encryption with key stretching
  const keyHash = await sha256(sharedSecret + iv);

  const textBytes = new TextEncoder().encode(text);
  const keyBytes = hexToBytes(keyHash);
  const encrypted = new Uint8Array(textBytes.length);

  for (let i = 0; i < textBytes.length; i++) {
    encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  const encryptedHex = Array.from(encrypted)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `${iv}:${encryptedHex}`;
}

export async function decryptMessage(encryptedPayload: string, sharedSecret: string): Promise<string> {
  const [iv, encryptedHex] = encryptedPayload.split(':');
  if (!iv || !encryptedHex) return encryptedPayload; // Not encrypted, return as-is

  const keyHash = await sha256(sharedSecret + iv);

  const encryptedBytes = hexToBytes(encryptedHex);
  const keyBytes = hexToBytes(keyHash);
  const decrypted = new Uint8Array(encryptedBytes.length);

  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  return new TextDecoder().decode(decrypted);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export function getFingerprint(publicKey: string): string {
  // Display-friendly fingerprint (first 16 chars grouped)
  const clean = publicKey.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  const groups: string[] = [];
  for (let i = 0; i < 16 && i < clean.length; i += 4) {
    groups.push(clean.substring(i, i + 4));
  }
  return groups.join(' ');
}
