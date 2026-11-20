import type { Block } from '@itti/schemas';
import type { ComponentType } from 'react';
import * as C from './components';

export * from './components';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<Block['type'], ComponentType<any>> = {
  hero: C.Hero,
  richText: C.RichText,
  image: C.ImageBlock,
  imageGallery: C.ImageGallery,
  twoColumn: C.TwoColumn,
  featureGrid: C.FeatureGrid,
  stats: C.Stats,
  testimonial: C.Testimonial,
  faq: C.Faq,
  cta: C.Cta,
  video: C.Video,
  downloads: C.Downloads,
  applyButton: C.ApplyButton,
  spacer: C.Spacer,
};

export type BlockRendererProps = {
  blocks: Block[] | undefined;
  /** Used by applyButton blocks with no explicit form, e.g. "/enroll/web-dev?course=web-dev" */
  defaultFormHref?: string;
};

/** Render an ordered list of blocks. Unknown block types are skipped. */
export function BlockRenderer({ blocks = [], defaultFormHref }: BlockRendererProps) {
  return (
    <>
      {blocks.map((b) => {
        const Comp = registry[b.type];
        if (!Comp) return null;
        return <Comp key={b.id} {...b} defaultFormHref={defaultFormHref} />;
      })}
    </>
  );
}
