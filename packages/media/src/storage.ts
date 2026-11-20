import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

export type Visibility = 'public' | 'private';

export interface StoredObject {
  /** Path relative to the visibility root, e.g. uploads/2026/11/abc.webp */
  key: string;
  visibility: Visibility;
  size: number;
  /** Public URL (public objects only). */
  url?: string;
}

/**
 * Storage adapter. LocalDiskStorage is used on cPanel: the API runs in the
 * same account as the media folder, so it writes straight to disk. Swap for an
 * S3/R2 or cPanel-UAPI adapter later without touching callers.
 */
export interface StorageAdapter {
  put(key: string, body: Buffer, visibility: Visibility): Promise<StoredObject>;
  read(key: string, visibility: Visibility): Promise<Readable>;
  remove(key: string, visibility: Visibility): Promise<void>;
  exists(key: string, visibility: Visibility): Promise<boolean>;
  publicUrl(key: string): string;
}

export type LocalDiskOptions = {
  /** cPanel: /home/<user>/media (document root of media.ittighana.com) */
  publicDir: string;
  /** cPanel: /home/<user>/private-uploads (NOT web accessible) */
  privateDir: string;
  /** https://media.ittighana.com */
  publicUrl: string;
};

export class LocalDiskStorage implements StorageAdapter {
  constructor(private readonly opts: LocalDiskOptions) {}

  private abs(key: string, visibility: Visibility) {
    const root = path.resolve(visibility === 'public' ? this.opts.publicDir : this.opts.privateDir);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, body: Buffer, visibility: Visibility): Promise<StoredObject> {
    const full = this.abs(key, visibility);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, { mode: visibility === 'private' ? 0o600 : 0o644 });
    return {
      key,
      visibility,
      size: body.length,
      url: visibility === 'public' ? this.publicUrl(key) : undefined,
    };
  }

  async read(key: string, visibility: Visibility) {
    return createReadStream(this.abs(key, visibility));
  }

  async remove(key: string, visibility: Visibility) {
    await rm(this.abs(key, visibility), { force: true });
  }

  async exists(key: string, visibility: Visibility) {
    try {
      await stat(this.abs(key, visibility));
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string) {
    return `${this.opts.publicUrl.replace(/\/$/, '')}/${key.split(path.sep).join('/')}`;
  }
}

/** uploads/YYYY/MM/<id>-<safe-name>.<ext> */
export function makeKey(originalName: string, ext?: string, prefix = 'uploads') {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const parsed = path.parse(originalName);
  const safe =
    parsed.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'file';
  const extension = (ext ?? parsed.ext.replace('.', '')).toLowerCase();
  return path.posix.join(prefix, yyyy, mm, `${randomUUID().slice(0, 8)}-${safe}.${extension}`);
}
