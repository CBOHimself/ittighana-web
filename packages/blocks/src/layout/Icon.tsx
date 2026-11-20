import type { RenderContext } from './context';
import { mediaSrc } from './media';

const EICON_TO_FA: Record<string, string> = {
  'eicon-star': 'fas fa-star',
  'eicon-check': 'fas fa-check',
  'eicon-chevron-right': 'fas fa-chevron-right',
  'eicon-chevron-left': 'fas fa-chevron-left',
  'eicon-chevron-down': 'fas fa-chevron-down',
  'eicon-close': 'fas fa-times',
  'eicon-menu-bar': 'fas fa-bars',
  'eicon-plus': 'fas fa-plus',
  'eicon-minus': 'fas fa-minus',
  'eicon-arrow-right': 'fas fa-arrow-right',
};

export type IconValue = { value?: unknown; library?: string } | string | undefined;

/** Font Awesome / Elementor icon or uploaded SVG from a stored icon setting. */
export function Icon({ icon, ctx, className = '' }: { icon: IconValue; ctx: Pick<RenderContext, 'mediaBase'>; className?: string }) {
  if (!icon) return null;
  if (typeof icon === 'string') return <i className={`${icon} ${className}`} aria-hidden />;
  const v = icon.value;
  if (!v) return null;
  if (icon.library === 'svg' && typeof v === 'object' && v && 'url' in v) {
    const src = mediaSrc((v as { url: string }).url, ctx);
    return src ? <img src={src} alt="" className={className} style={{ width: '1em', height: '1em' }} /> : null;
  }
  if (typeof v !== 'string') return null;
  return <i className={`${EICON_TO_FA[v] ?? v} ${className}`} aria-hidden />;
}
