import type { Paginated } from '@itti/schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FiEdit2, FiFileText } from 'react-icons/fi';
import { Navigate, useNavigate, useParams } from 'react-router';
import { http } from '@/lib/api';
import { resourceByKey } from '@/resources';
import { Button, DataTable, EmptyState, PageTitle, Spinner, statusCell, type ColumnDefinition, type DataTableRow, type TabDefinition } from '@/ui';

type Row = { _id: string; status?: string; updatedAt: string; slug?: string; [k: string]: unknown };

/** Generic list for every content resource, rendered with vantara-ui DataTable. */
export function ResourceListPage() {
  const { resource = '' } = useParams();
  const r = resourceByKey(resource);
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['list', resource, q],
    queryFn: () => http<Paginated<Row>>(`/admin/${r!.path}?${new URLSearchParams({ q, limit: '100' })}`),
    enabled: Boolean(r),
  });

  const rows: DataTableRow[] = useMemo(
    () =>
      (data?.items ?? []).map((row) => ({
        id: row._id,
        title: String(row[r?.titleField ?? 'title'] ?? ''),
        slug: row.slug ? `/${row.slug}` : '',
        updated: new Date(row.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
        ...(r?.hasStatus ? statusCell('status', row.status) : {}),
      })),
    [data, r],
  );

  if (!r) return <Navigate to="/" replace />;

  const columns: ColumnDefinition[] = [
    { key: 'title', label: r.singular, type: 'text', sortable: true },
    { key: 'slug', label: 'Slug', type: 'text', mobileHide: true },
    ...(r.hasStatus ? [{ key: 'status', label: 'Status', type: 'status' as const, filterable: true }] : []),
    { key: 'updated', label: 'Updated', type: 'text', sortable: true, mobileHide: true },
  ];

  const counts = (s: string) => (data?.items ?? []).filter((x) => (x.status ?? 'draft') === s).length;
  const tabs: TabDefinition[] | undefined = r.hasStatus
    ? [
        { label: 'All', value: 'all', count: data?.items.length ?? 0 },
        { label: 'Published', value: 'published', count: counts('published'), filterKey: 'status', filterValue: 'published' },
        { label: 'Draft', value: 'draft', count: counts('draft'), filterKey: 'status', filterValue: 'draft' },
        { label: 'In review', value: 'review', count: counts('review'), filterKey: 'status', filterValue: 'review' },
      ]
    : undefined;

  return (
    <>
      <PageTitle title={r.label} actions={<Button onClick={() => navigate(`/content/${r.key}/new`)}>New {r.singular.toLowerCase()}</Button>} />
      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 && !q ? (
        <EmptyState
          title={`No ${r.label.toLowerCase()} yet`}
          description="Create the first one, or run the WordPress import."
          icon={<FiFileText />}
          action={<Button onClick={() => navigate(`/content/${r.key}/new`)}>New {r.singular.toLowerCase()}</Button>}
        />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          tabs={tabs}
          pageSize={25}
          searchPlaceholder={`Search ${r.label.toLowerCase()}…`}
          onSearch={setQ}
          onRowClick={(row) => navigate(`/content/${r.key}/${row.id}`)}
          actions={[{ id: 'edit', action: 'edit', icon: <FiEdit2 /> }]}
          onAction={(_action, row) => navigate(`/content/${r.key}/${row.id}`)}
        />
      )}
    </>
  );
}
