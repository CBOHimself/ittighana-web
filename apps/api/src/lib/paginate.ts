import type { Paginated, PaginationQuery } from '@itti/schemas';
import type { Model } from 'mongoose';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>;

export async function paginate<T>(
  model: AnyModel,
  filter: Record<string, unknown>,
  { page, limit }: Pick<PaginationQuery, 'page' | 'limit'>,
  sort: Record<string, 1 | -1> = { createdAt: -1 },
  projection?: string,
): Promise<Paginated<T>> {
  const [items, total] = await Promise.all([
    model
      .find(filter, projection)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    model.countDocuments(filter),
  ]);
  return { items: items as T[], page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Escape user input for use inside a RegExp. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
