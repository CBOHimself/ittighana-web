import type { Paginated } from '@itti/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { API_URL } from '@/lib/env';
import { http } from '@/lib/api';
import { Badge, Button, Card, Input, PageTitle, Select, Spinner, Table, Textarea } from '@/ui';

type Sub = {
  _id: string;
  formId: string | { _id: string; name: string; fields: Array<{ name: string; label: string; type: string }> };
  applicant: { name?: string; email?: string; phone?: string };
  context?: { kind: string; title: string };
  status: string;
  createdAt: string;
  data?: Record<string, unknown>;
  files?: Array<{ field: string; mediaId: string; originalName: string }>;
  notes?: Array<{ by: string; text: string; at: string }>;
};
type FormLite = { _id: string; name: string };

const STATUSES = ['new', 'reviewing', 'shortlisted', 'accepted', 'rejected', 'withdrawn'];

export function ApplicantsPage() {
  const { id } = useParams();
  return id ? <ApplicantDetail id={id} /> : <ApplicantList />;
}

function ApplicantList() {
  const navigate = useNavigate();
  const [formId, setFormId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const forms = useQuery({ queryKey: ['forms-lite'], queryFn: () => http<Paginated<FormLite>>('/admin/forms?limit=100') });
  const subs = useQuery({
    queryKey: ['submissions', formId, status, q],
    queryFn: () => http<Paginated<Sub>>(`/admin/submissions?${new URLSearchParams({ formId, status, q, limit: '50' })}`),
  });

  return (
    <>
      <PageTitle
        title="Applicants"
        actions={formId ? <a href={`${API_URL}/v1/admin/submissions/export/${formId}`}><Button variant="secondary">Export CSV</Button></a> : undefined}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={formId} onChange={(e) => setFormId(e.target.value)} options={[{ label: 'All forms', value: '' }, ...(forms.data?.items ?? []).map((f) => ({ label: f.name, value: f._id }))]} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ label: 'All statuses', value: '' }, ...STATUSES.map((s) => ({ label: s, value: s }))]} />
        <Input placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {subs.isLoading ? <Spinner /> : (
          <Table<Sub>
            rows={subs.data?.items ?? []}
            onRowClick={(s) => navigate(`/applicants/${s._id}`)}
            columns={[
              { key: 'name', header: 'Applicant', render: (s) => <div><div className="font-medium">{s.applicant?.name || '—'}</div><div className="text-xs text-gray-500">{s.applicant?.email}</div></div> },
              { key: 'ctx', header: 'For', render: (s) => s.context?.title ?? '—' },
              { key: 'status', header: 'Status', render: (s) => <Badge>{s.status}</Badge> },
              { key: 'date', header: 'Submitted', render: (s) => new Date(s.createdAt).toLocaleString('en-GB'), className: 'text-gray-500 whitespace-nowrap' },
            ]}
          />
        )}
      </div>
    </>
  );
}

function ApplicantDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const { data: s, isLoading } = useQuery({ queryKey: ['submission', id], queryFn: () => http<Sub>(`/admin/submissions/${id}`) });
  const update = useMutation({
    mutationFn: (body: { status?: string; note?: string }) => http<Sub>(`/admin/submissions/${id}`, { method: 'PATCH', json: body }),
    onSuccess: (data) => {
      qc.setQueryData(['submission', id], (old: Sub | undefined) => ({ ...old, ...data }));
      qc.invalidateQueries({ queryKey: ['submissions'] });
      setNote('');
    },
  });
  if (isLoading || !s) return <Spinner />;
  const form = typeof s.formId === 'object' ? s.formId : null;
  const labels = Object.fromEntries((form?.fields ?? []).map((f) => [f.name, f.label]));

  return (
    <>
      <PageTitle title={s.applicant?.name || 'Applicant'} subtitle={`${form?.name ?? ''}${s.context ? ` · ${s.context.title}` : ''}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="Application">
          <dl className="divide-y divide-gray-100 text-sm">
            {Object.entries(s.data ?? {}).map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-4 py-2">
                <dt className="text-gray-500">{labels[k] ?? k}</dt>
                <dd className="col-span-2 whitespace-pre-wrap">{Array.isArray(v) ? v.join(', ') : String(v ?? '')}</dd>
              </div>
            ))}
          </dl>
          {!!s.files?.length && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Documents</h3>
              <ul className="space-y-1 text-sm">
                {s.files.map((f) => (
                  <li key={f.mediaId}>
                    <a className="text-brand hover:underline" href={`${API_URL}/v1/admin/submissions/${s._id}/files/${f.mediaId}`}>{labels[f.field] ?? f.field}: {f.originalName}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Status">
            <Select value={s.status} onChange={(e) => update.mutate({ status: e.target.value })} options={STATUSES.map((x) => ({ label: x, value: x }))} />
          </Card>
          <Card title="Notes">
            <ul className="mb-4 space-y-3 text-sm">
              {(s.notes ?? []).map((n, i) => (
                <li key={i}><div className="text-gray-800">{n.text}</div><div className="text-xs text-gray-400">{n.by} · {new Date(n.at).toLocaleString('en-GB')}</div></li>
              ))}
            </ul>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Add a note…" />
            <Button className="mt-2" disabled={!note.trim()} loading={update.isPending} onClick={() => update.mutate({ note })}>Add note</Button>
          </Card>
        </div>
      </div>
    </>
  );
}
