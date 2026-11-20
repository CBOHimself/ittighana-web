import sharp from 'sharp';

export const VARIANT_WIDTHS = { sm: 480, md: 960, lg: 1600 } as const;
export type VariantName = keyof typeof VARIANT_WIDTHS;

export type ProcessedImage = {
  original: { buffer: Buffer; width: number; height: number; ext: string; mime: string };
  variants: Partial<Record<VariantName, { buffer: Buffer; width: number; height: number }>>;
};

/**
 * Re-encode every image upload: strips EXIF/GPS (and anything hidden in the
 * file), caps the original at 2400px wide, and creates WebP size variants.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const img = sharp(input, { failOn: 'error' }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error('Unreadable image');

  const isGif = meta.format === 'gif';
  const pipeline = isGif
    ? sharp(input, { animated: true }).resize({ width: 2400, withoutEnlargement: true }).gif()
    : img.clone().resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 82 });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  const variants: ProcessedImage['variants'] = {};
  if (!isGif) {
    for (const [name, width] of Object.entries(VARIANT_WIDTHS) as [VariantName, number][]) {
      if (meta.width <= width) continue;
      const v = await img
        .clone()
        .resize({ width })
        .webp({ quality: 78 })
        .toBuffer({ resolveWithObject: true });
      variants[name] = { buffer: v.data, width: v.info.width, height: v.info.height };
    }
  }

  return {
    original: {
      buffer: data,
      width: info.width,
      height: info.height,
      ext: isGif ? 'gif' : 'webp',
      mime: isGif ? 'image/gif' : 'image/webp',
    },
    variants,
  };
}
