/** Max characters per Socket.IO chunk (stay under relay buffer limits). */
export const MEDIA_CHUNK_SIZE = 24000;

export function splitPayload(s: string): string[] {
  if (!s.length) return [''];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += MEDIA_CHUNK_SIZE) {
    out.push(s.slice(i, i + MEDIA_CHUNK_SIZE));
  }
  return out;
}
