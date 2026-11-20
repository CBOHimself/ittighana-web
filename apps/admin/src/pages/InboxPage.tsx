import type { Paginated } from '@itti/schemas';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { http } from '@/lib/api';
import { Card, PageTitle, Spinner, Table } from '@/ui';

type Msg = { _id: string; name: string; email: string; phone?: string; subject?: string; message: string; read: boolean; createdAt: string };

export function InboxPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['inbox'], queryFn: () => http<Paginated<Msg>>('/admin/inbox?limit=100') });
  const msg = useQuery({ queryKey: ['inbox', id], queryFn: () => http<Msg>(`/admin/inbox/${id}`), enabled: Boolean(id) });

  return (
    <>
      <PageTitle title="Inbox" subtitle="Messages from the Contact Us page" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {list.isLoading ? <Spinner /> : (
            <Table<Msg>
              rows={list.data?.items ?? []}
              onRowClick={(m) => navigate(`/inbox/${m._id}`)}
              columns={[
                { key: 'from', header: 'From', render: (m) => <span className={m.read ? '' : 'font-semibold'}>{m.name}</span> },
                { key: 'subject', header: 'Subject', render: (m) => <span className="text-gray-600">{m.subject || m.message.slice(0, 50)}</span> },
                { key: 'date', header: 'Received', render: (m) => new Date(m.createdAt).toLocaleDateString('en-GB'), className: 'text-gray-500' },
              ]}
            />
          )}
        </div>
        {id && (
          <Card title={msg.data?.subject || 'Message'}>
            {msg.isLoading || !msg.data ? <Spinner /> : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  <div><strong>{msg.data.name}</strong> &lt;{msg.data.email}&gt;</div>
                  {msg.data.phone && <div>{msg.data.phone}</div>}
                  <div className="text-gray-400">{new Date(msg.data.createdAt).toLocaleString('en-GB')}</div>
                </div>
                <p className="whitespace-pre-wrap">{msg.data.message}</p>
                <a className="mt-6 inline-block text-sm font-medium text-brand" href={`mailto:${msg.data.email}?subject=Re: ${encodeURIComponent(msg.data.subject ?? 'Your enquiry')}`}>Reply by email →</a>
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
