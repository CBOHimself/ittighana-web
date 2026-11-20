import { ROLES } from '@itti/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { http } from '@/lib/api';
import { Alert, Badge, Button, Card, FormField, Input, PageTitle, Select, Spinner, Table } from '@/ui';

type User = { id: string; _id: string; name: string; email: string; role: string; banned?: boolean; twoFactorEnabled?: boolean; createdAt: string };

/** Roles that can sign in to the portal (matches the API's PORTAL_ROLES default). */
const PORTAL_ROLES = ['super_admin', 'admin'];

export function UsersPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', role: 'editor' });
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => http<{ users: User[] }>('/admin/users') });
  const invite = useMutation({
    mutationFn: () => http('/admin/users/invite', { method: 'POST', json: form }),
    onSuccess: () => { setForm({ name: '', email: '', role: 'editor' }); qc.invalidateQueries({ queryKey: ['users'] }); },
  });
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => http(`/admin/users/${id}/role`, { method: 'POST', json: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <>
      <PageTitle title="Users & roles" subtitle="Invite only: new users get an email to set their password." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? <Spinner /> : (
            <Table<User>
              rows={(data?.users ?? []).map((u) => ({ ...u, _id: u.id }))}
              columns={[
                { key: 'name', header: 'User', render: (u) => <div><div className="font-medium">{u.name}</div><div className="text-xs text-gray-500">{u.email}</div></div> },
                { key: 'role', header: 'Role', render: (u) => <Select value={u.role} onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })} options={ROLES.map((r) => ({ label: r.replace('_', ' '), value: r }))} /> },
                { key: 'status', header: 'Access', render: (u) => <Badge>{u.banned ? 'suspended' : PORTAL_ROLES.includes(u.role) ? 'active' : 'no portal access'}</Badge> },
              ]}
            />
          )}
        </div>
        <Card title="Invite a user">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
            <FormField label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
            <FormField label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></FormField>
            <FormField label="Role" hint="Only super admins and admins can sign in to the portal for now."><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLES.map((r) => ({ label: r.replace('_', ' '), value: r }))} /></FormField>
            {invite.error && <Alert>{(invite.error as Error).message}</Alert>}
            {invite.isSuccess && <Alert kind="success">Invitation sent.</Alert>}
            <Button type="submit" loading={invite.isPending} className="w-full">Send invite</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
