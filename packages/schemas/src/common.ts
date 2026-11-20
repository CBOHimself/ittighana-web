import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export type ObjectIdString = z.infer<typeof objectId>;

export const slug = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes');

export const publishStatus = z.enum(['draft', 'review', 'published', 'archived']);
export type PublishStatus = z.infer<typeof publishStatus>;

export const seo = z
  .object({
    title: z.string().max(70).optional(),
    description: z.string().max(170).optional(),
    ogImage: z.string().url().optional(),
    noindex: z.boolean().optional(),
    canonical: z.string().url().optional(),
  })
  .default({});
export type Seo = z.infer<typeof seo>;

/** Reference to a file in the media library, denormalised for fast rendering. */
export const mediaRef = z.object({
  id: objectId.optional(),
  url: z.string(),
  alt: z.string().default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type MediaRef = z.infer<typeof mediaRef>;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

/** Fields every stored document carries (added by the API / Mongoose). */
export type WithMeta<T> = T & {
  _id: string;
  createdAt: string;
  updatedAt: string;
};
