import type { ImageFallback } from '@itti/blocks/layout';

/**
 * Logos shipped with the web app (public/brand). They stand in when the media server
 * can't serve the originals, so the header and footer are never left without a logo.
 */
export const IMAGE_FALLBACKS: ImageFallback[] = [
  { match: 'ITTI_long-logo', src: '/brand/itti-logo-long.png' },
  { match: 'ITTI_LOGO', src: '/brand/itti-logo.png' },
];
