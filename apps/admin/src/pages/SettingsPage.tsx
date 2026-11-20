import type { SiteSettingsInput } from '@itti/schemas';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { http } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import { Alert, Button, Card, FormField, Input, PageTitle, Spinner, toast } from '@/ui';

export function SettingsPage() {
  const canWatermark = usePermission('watermark:manage');
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => http<SiteSettingsInput>('/admin/settings') });
  const [s, setS] = useState<SiteSettingsInput>();
  useEffect(() => { if (data) setS(data); }, [data]);
  const save = useMutation({
    mutationFn: (body: SiteSettingsInput) => http('/admin/settings', { method: 'PUT', json: body }),
    onSuccess: () => toast.success('Settings saved', { description: 'The website updates within seconds.' }),
  });

  if (isLoading || !s) return <Spinner />;
  const patch = <K extends keyof SiteSettingsInput>(k: K, v: Partial<SiteSettingsInput[K]>) =>
    setS({ ...s, [k]: typeof v === 'object' && !Array.isArray(v) ? { ...(s[k] as object), ...v } : v });

  return (
    <>
      <PageTitle title="Settings" actions={<Button onClick={() => save.mutate(s)} loading={save.isPending}>Save</Button>} />
      {save.error && <div className="mb-4"><Alert>{(save.error as Error).message}</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="General">
          <div className="space-y-4">
            <FormField label="Site name"><Input value={s.siteName} onChange={(e) => setS({ ...s, siteName: e.target.value })} /></FormField>
            <FormField label="Tagline"><Input value={s.tagline ?? ''} onChange={(e) => setS({ ...s, tagline: e.target.value })} /></FormField>
          </div>
        </Card>
        <Card title="WhatsApp button">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.whatsapp.enabled} onChange={(e) => patch('whatsapp', { enabled: e.target.checked })} /> Show the WhatsApp button</label>
            <FormField label="Number" hint="International format, e.g. 233201234567"><Input value={s.whatsapp.number} onChange={(e) => patch('whatsapp', { number: e.target.value })} /></FormField>
            <FormField label="Pre-filled message"><Input value={s.whatsapp.message} onChange={(e) => patch('whatsapp', { message: e.target.value })} /></FormField>
          </div>
        </Card>
        <Card title="Contact">
          <div className="space-y-4">
            <FormField label="Public email"><Input type="email" value={s.contact.email ?? ''} onChange={(e) => patch('contact', { email: e.target.value || undefined })} /></FormField>
            <FormField label="Phones" hint="Comma separated"><Input value={s.contact.phones.join(', ')} onChange={(e) => patch('contact', { phones: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></FormField>
            <FormField label="Address"><Input value={s.contact.address ?? ''} onChange={(e) => patch('contact', { address: e.target.value })} /></FormField>
            <FormField label="Notification emails" hint="Who receives contact, booking and application alerts (comma separated)">
              <Input value={s.contact.notifyEmails.join(', ')} onChange={(e) => patch('contact', { notifyEmails: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </FormField>
          </div>
        </Card>
        <Card title="HostHaus watermark">
          {canWatermark ? (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.watermark.enabled} onChange={(e) => patch('watermark', { enabled: e.target.checked })} /> Show “{s.watermark.label}” in the footer</label>
              <FormField label="Label"><Input value={s.watermark.label} onChange={(e) => patch('watermark', { label: e.target.value })} /></FormField>
              <FormField label="Link"><Input value={s.watermark.url} onChange={(e) => patch('watermark', { url: e.target.value })} /></FormField>
            </div>
          ) : <p className="text-sm text-gray-500">Only a super admin can change the watermark.</p>}
        </Card>
      </div>
    </>
  );
}
