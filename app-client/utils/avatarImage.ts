import * as FileSystem from 'expo-file-system/legacy';

/** Max approximate JSON payload for avatar data URIs (~2MB raw image when base64-decoded). */
const MAX_BASE64_CHARS = 2_800_000;

function guessMimeType(uri: string, mimeType: string | null | undefined): string {
  if (mimeType && mimeType.startsWith('image/')) return mimeType;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Reads a picked image and returns a portable `data:image/...;base64,...` string for API storage.
 * Local `file://` paths are not valid on other devices; data URIs work everywhere.
 */
export async function imageAssetToDataUri(asset: {
  uri: string;
  mimeType?: string | null;
}): Promise<string> {
  let readUri = asset.uri.trim();
  if (!readUri) {
    throw new Error('MISSING_URI');
  }
  if (!readUri.includes('://') && readUri.startsWith('/')) {
    readUri = `file://${readUri}`;
  }

  if (!readUri.startsWith('file://')) {
    const dest = `${FileSystem.cacheDirectory}avatar-upload-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: readUri, to: dest });
    readUri = dest;
  }

  const b64 = await FileSystem.readAsStringAsync(readUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (b64.length > MAX_BASE64_CHARS) {
    throw new Error('IMAGE_TOO_LARGE');
  }

  const mime = guessMimeType(readUri, asset.mimeType);
  return `data:${mime};base64,${b64}`;
}

export function canDisplayAvatarUri(avatar: string | null | undefined): boolean {
  if (!avatar || typeof avatar !== 'string') return false;
  const t = avatar.trim();
  const lower = t.toLowerCase();
  if (lower.startsWith('data:image/')) return true;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return true;
  if (lower.startsWith('file://')) return true;
  return false;
}
