import type { ContentType, TemplateField } from '@itti/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import { Badge, Button, Card, EmptyState, PageTitle, Spinner, toast } from '@/ui';

type TemplateSummary = { _id: string; slug: string; title: string; description?: string; isDefault?: boolean; fields: TemplateField[] };
type ContentTypeInfo = { type: ContentType; singular: string; plural: string; urlPrefix: string; templates: TemplateSummary[] };

/**
 * Content templates per content type: which one is the default, and which fields each shows.
 * Layout editing arrives with the page builder; for now templates come from migrations.
 */
export function TemplatesPage() {
  const qc = useQueryClient();
  const canManage = usePermission('settings:manage');
  const { data, isLoading } = useQuery({ queryKey: ['content-types'], queryFn: () => http<ContentTypeInfo[]>('/admin/templates/content-types') });
  const run = useMutation({
    mutationFn: ({ id, op }: { id: string; op: 'make-default' | 'sync-fields' }) => http(`/admin/templates/${id}/${op}`, { method: 'POST' }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['content-types'] });
      toast.success(v.op === 'make-default' ? 'Default template updated' : 'Fields refreshed from the layout');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !data) return <Spinner />;
  return (
    <>
      <PageTitle title="Templates" subtitle="How each type of content looks on the website. New content starts by picking one." />
      <div className="space-y-6">
        {data.map((t) => (
          <Card key={t.type} title={t.plural}>
            {t.templates.length === 0 ? (
              <EmptyState title={`No ${t.plural.toLowerCase()} templates`} description="Run the database migrations to add the standard templates." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {t.templates.map((tpl) => (
                  <div key={tpl._id} className="rounded-card border border-line p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{tpl.title}</span>
                      {tpl.isDefault && <Badge>default</Badge>}
                    </div>
                    {tpl.description && <p className="mb-3 text-sm text-text-primary">{tpl.description}</p>}
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {tpl.fields.map((f) => (
                        <span key={f.key} className="rounded-badge bg-surface-muted px-2 py-0.5 text-xs text-text-primary">
                          {f.label}{f.required ? ' *' : ''}
                        </span>
                      ))}
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        {!tpl.isDefault && <Button variant="secondary" onClick={() => run.mutate({ id: tpl._id, op: 'make-default' })}>Make default</Button>}
                        <Button variant="ghost" onClick={() => run.mutate({ id: tpl._id, op: 'sync-fields' })}>Refresh fields</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
