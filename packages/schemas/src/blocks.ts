import { z } from 'zod';
import { mediaRef } from './common';

/**
 * Block library: the building blocks admins use to compose pages, courses,
 * careers, events and articles. Each Elementor widget from the current
 * WordPress site maps to one of these (see tools/wp-migrate/src/elementor-map.ts).
 */
const base = { id: z.string().min(1) };
const cta = z.object({ label: z.string(), href: z.string() });

export const heroBlock = z.object({
  ...base,
  type: z.literal('hero'),
  heading: z.string(),
  subheading: z.string().optional(),
  image: mediaRef.optional(),
  primaryCta: cta.optional(),
  secondaryCta: cta.optional(),
  align: z.enum(['left', 'center']).default('left'),
  overlay: z.boolean().default(true),
});

export const richTextBlock = z.object({
  ...base,
  type: z.literal('richText'),
  /** Sanitised HTML (Tiptap output or migrated Elementor text). */
  html: z.string(),
});

export const imageBlock = z.object({
  ...base,
  type: z.literal('image'),
  image: mediaRef,
  caption: z.string().optional(),
  href: z.string().optional(),
});

export const imageGalleryBlock = z.object({
  ...base,
  type: z.literal('imageGallery'),
  images: z.array(mediaRef.extend({ caption: z.string().optional() })),
  columns: z.number().int().min(1).max(6).default(3),
  lightbox: z.boolean().default(true),
});

export const twoColumnBlock = z.object({
  ...base,
  type: z.literal('twoColumn'),
  heading: z.string().optional(),
  html: z.string(),
  image: mediaRef.optional(),
  imagePosition: z.enum(['left', 'right']).default('right'),
  cta: cta.optional(),
});

export const featureGridBlock = z.object({
  ...base,
  type: z.literal('featureGrid'),
  heading: z.string().optional(),
  items: z.array(
    z.object({
      title: z.string(),
      text: z.string().optional(),
      icon: z.string().optional(),
      image: mediaRef.optional(),
      href: z.string().optional(),
    }),
  ),
  columns: z.number().int().min(1).max(6).default(3),
});

export const statsBlock = z.object({
  ...base,
  type: z.literal('stats'),
  items: z.array(z.object({ value: z.string(), label: z.string() })),
});

export const testimonialBlock = z.object({
  ...base,
  type: z.literal('testimonial'),
  items: z.array(
    z.object({ quote: z.string(), name: z.string(), role: z.string().optional(), photo: mediaRef.optional() }),
  ),
});

export const faqBlock = z.object({
  ...base,
  type: z.literal('faq'),
  heading: z.string().optional(),
  items: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export const ctaBlock = z.object({
  ...base,
  type: z.literal('cta'),
  heading: z.string(),
  text: z.string().optional(),
  button: cta,
  variant: z.enum(['primary', 'secondary', 'dark']).default('primary'),
});

export const videoBlock = z.object({
  ...base,
  type: z.literal('video'),
  url: z.string().url(),
  title: z.string().optional(),
});

export const downloadsBlock = z.object({
  ...base,
  type: z.literal('downloads'),
  heading: z.string().optional(),
  files: z.array(z.object({ label: z.string(), url: z.string() })),
});

export const applyButtonBlock = z.object({
  ...base,
  type: z.literal('applyButton'),
  label: z.string().default('Apply now'),
  /** Form slug; defaults to the parent item's linked form. */
  formSlug: z.string().optional(),
});

export const spacerBlock = z.object({
  ...base,
  type: z.literal('spacer'),
  size: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
});

export const block = z.discriminatedUnion('type', [
  heroBlock,
  richTextBlock,
  imageBlock,
  imageGalleryBlock,
  twoColumnBlock,
  featureGridBlock,
  statsBlock,
  testimonialBlock,
  faqBlock,
  ctaBlock,
  videoBlock,
  downloadsBlock,
  applyButtonBlock,
  spacerBlock,
]);
export const blocks = z.array(block).default([]);

export type Block = z.infer<typeof block>;
export type BlockType = Block['type'];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const BLOCK_TYPES = block.options.map((o) => o.shape.type.value) as BlockType[];
