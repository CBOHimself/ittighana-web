import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import type { RoutedRecord } from '@/lib/types';

export const revalidate = 3600;

type Item = Pick<RoutedRecord, 'path'> & { updatedAt?: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lists = await Promise.all(
    ['page', 'course', 'news', 'article'].map((t) => api<Item[]>(`/list/${t}`, { tags: ['content'], query: { limit: 100, sort: 'title' } }).catch(() => [] as Item[])),
  );
  return lists
    .flat()
    .filter((i) => i.path)
    .map((i) => ({ url: `${SITE_URL}${i.path === '/' ? '' : i.path}`, lastModified: i.updatedAt }));
}
