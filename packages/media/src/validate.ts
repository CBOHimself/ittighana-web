/** Upload allow-lists. Checked against file signatures, not just the extension. */
export const PUBLIC_ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'application/pdf',
  'video/mp4',
] as const;

export const PRIVATE_ALLOWED = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const MAX_UPLOAD_MB = { image: 15, document: 10, video: 100 } as const;

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const signatures: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  { mime: 'image/avif', bytes: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], offset: 4 },
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

/** Best-effort MIME sniffing from the file header. */
export function sniffMime(buf: Buffer): string | null {
  for (const s of signatures) {
    const off = s.offset ?? 0;
    if (s.bytes.every((b, i) => buf[off + i] === b)) return s.mime;
  }
  return null;
}

/** Returns the trusted MIME type, or null if the file isn't allowed. */
export function trustedMime(declared: string, buf: Buffer, allowed: readonly string[]): string | null {
  const sniffed = sniffMime(buf);
  if (!sniffed) return null;
  const mime = sniffed === 'application/zip' && declared === DOCX ? DOCX : sniffed;
  return allowed.includes(mime) ? mime : null;
}
