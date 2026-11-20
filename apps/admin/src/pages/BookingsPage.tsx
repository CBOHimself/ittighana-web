import type { Paginated } from '@itti/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { http } from '@/lib/api';
import { Alert, Badge, Button, PageTitle, Select, Spinner, Table } from '@/ui';

type Booking = { _id: string; name: string; email: string; phone: string; purpose?: string; attendees?: number; start: string; end: string; status: string; spaceId: string };

const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function BookingsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const { data, isLoading } = useQuery({
    queryKey: ['bookings', status],
    queryFn: () => http<Paginated<Booking>>(`/admin/bookings?${new URLSearchParams({ status, limit: '100' })}`),
  });
  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'declined' | 'cancelled' }) =>
      http(`/admin/bookings/${id}/decision`, { method: 'POST', json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });

  return (
    <>
      <PageTitle title="Space bookings" subtitle="Approving re-checks for clashes with other approved bookings." />
      <div className="mb-4 max-w-xs">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={['pending', 'approved', 'declined', 'cancelled', ''].map((s) => ({ label: s || 'All', value: s }))} />
      </div>
      {decide.error && <div className="mb-4"><Alert>{(decide.error as Error).message}</Alert></div>}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? <Spinner /> : (
          <Table<Booking>
            rows={data?.items ?? []}
            columns={[
              { key: 'when', header: 'When', render: (b) => <div className="whitespace-nowrap">{fmt(b.start)}<div className="text-xs text-gray-500">to {fmt(b.end)}</div></div> },
              { key: 'who', header: 'Requested by', render: (b) => <div><div className="font-medium">{b.name}</div><div className="text-xs text-gray-500">{b.email} · {b.phone}</div></div> },
              { key: 'purpose', header: 'Purpose', render: (b) => <span className="text-gray-600">{b.purpose} {b.attendees ? `(${b.attendees})` : ''}</span> },
              { key: 'status', header: 'Status', render: (b) => <Badge>{b.status}</Badge> },
              {
                key: 'actions', header: '', render: (b) => (
                  <div className="flex gap-2">
                    {b.status !== 'approved' && <Button onClick={() => decide.mutate({ id: b._id, status: 'approved' })}>Approve</Button>}
                    {b.status === 'pending' && <Button variant="secondary" onClick={() => decide.mutate({ id: b._id, status: 'declined' })}>Decline</Button>}
                    {b.status === 'approved' && <Button variant="secondary" onClick={() => decide.mutate({ id: b._id, status: 'cancelled' })}>Cancel</Button>}
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
    </>
  );
}
