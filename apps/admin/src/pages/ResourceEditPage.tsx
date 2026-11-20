import { BlockRenderer } from '@itti/blocks';
import type { Block } from '@itti/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { http } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import { resourceByKey } from '@/resources';
import { TemplatedEditor } from './TemplatedEditor';
import { Alert, Badge, Button, Card, FormField, Input, PageTitle, Select, Spinner, Textarea, toast } from '@/ui';

type Doc = Record<string, unknown> & { _id?: string; status?: string; blocks?: Block[] };

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Generic editor: common fields (title, slug, template, status, SEO) plus a raw
 * JSON panel for type-specific fields. Phase 2+ replaces the JSON panel with
 * dedicated editors per resource (block editor, course facts, form builder, calendar…).
 */
export function ResourceEditPage() {
  const { resource = '', id } = useParams();
  const r = resourceByKey(resource);
  // Courses, news, events, student articles and careers: template picker + generated form.
  if (r?.contentType) return <TemplatedEditor key={`${resource}:${id ?? 'new'}`} r={{ ...r, contentType: r.contentType }} id={id} />;
  return <GenericEditor />;
}

function GenericEditor() {
  const { resource = '', id } = useParams();
  const r = resourceByKey(resource);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canPublish = usePermission('content:publish');
  const isNew = !id;

  const { data, isLoading } = useQuery({
    queryKey: ['doc', resource, id],
    queryFn: () => http<Doc>(`/admin/${r!.path}/${id}`),
    enabled: Boolean(r && id),
  });

  const [doc, setDoc] = useState<Doc>({});
  const [json, setJson] = useState('{}');
  const [jsonError, setJsonError] = useState<string>();
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (data) {
      setDoc(data);
      const { _id, createdAt, updatedAt, createdBy, updatedBy, ...rest } = data;
      void _id; void createdAt; void updatedAt; void createdBy; void updatedBy;
      setJson(JSON.stringify(rest, null, 2));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (body: Doc) =>
      isNew
        ? http<Doc>(`/admin/${r!.path}`, { method: 'POST', json: body })
        : http<Doc>(`/admin/${r!.path}/${id}`, { method: 'PATCH', json: body }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['list', resource] });
      qc.setQueryData(['doc', resource, saved._id], saved);
      toast.success(`${r!.singular} saved`);
      if (isNew) navigate(`/content/${resource}/${saved._id}`, { replace: true });
    },
  });

  const action = useMutation({
    mutationFn: (a: 'publish' | 'unpublish') => http<Doc>(`/admin/${r!.path}/${id}/${a}`, { method: 'POST' }),
    onSuccess: (saved, a) => {
      qc.setQueryData(['doc', resource, id], saved);
      toast.success(a === 'publish' ? 'Published' : 'Unpublished');
    },
  });

  const remove = useMutation({
    mutationFn: () => http(`/admin/${r!.path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(`${r!.singular} deleted`);
      navigate(`/content/${resource}`);
    },
  });

  if (!r) return <Navigate to="/" replace />;
  if (!isNew && (isLoading || !data)) return <Spinner />;

  const title = String(doc[r.titleField] ?? '');
  const set = (k: string, v: unknown) => {
    setDoc((d) => ({ ...d, [k]: v }));
    try {
      const parsed = JSON.parse(json);
      setJson(JSON.stringify({ ...parsed, [k]: v }, null, 2));
    } catch { /* user is editing JSON */ }
  };

  function onSave() {
    try {
      const body = JSON.parse(json) as Doc;
      setJsonError(undefined);
      save.mutate(body);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle
        title={isNew ? `New ${r.singular.toLowerCase()}` : title || r.singular}
        subtitle={r.label}
        actions={
          <>
            {!isNew && r.hasStatus && canPublish && (
              doc.status === 'published'
                ? <Button variant="secondary" onClick={() => action.mutate('unpublish')} loading={action.isPending}>Unpublish</Button>
                : <Button variant="secondary" onClick={() => action.mutate('publish')} loading={action.isPending}>Publish</Button>
            )}
            <Button onClick={onSave} loading={save.isPending}>Save</Button>
          </>
        }
      />
      {save.error && <div className="mb-4"><Alert>{(save.error as Error).message}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={r.titleField === 'name' ? 'Name' : 'Title'}>
                <Input value={title} onChange={(e) => { set(r.titleField, e.target.value); if (isNew) set('slug', slugify(e.target.value)); }} />
              </FormField>
              <FormField label="Slug" hint="Used in the page URL">
                <Input value={String(doc.slug ?? '')} onChange={(e) => set('slug', slugify(e.target.value))} />
              </FormField>
              {r.templates && (
                <FormField label="Template">
                  <Select value={String(doc.template ?? r.templates[0])} onChange={(e) => set('template', e.target.value)} options={r.templates.map((t) => ({ label: t, value: t }))} />
                </FormField>
              )}
              {r.hasStatus && !isNew && <FormField label="Status"><div className="pt-2"><Badge>{doc.status ?? 'draft'}</Badge></div></FormField>}
            </div>
          </Card>

          <Card title="All fields (JSON)" actions={<span className="text-xs text-gray-400">Dedicated editors arrive per phase</span>}>
            <Textarea value={json} onChange={(e) => setJson(e.target.value)} rows={22} className="font-mono text-xs" spellCheck={false} />
            {jsonError && <div className="mt-2"><Alert>Invalid JSON: {jsonError}</Alert></div>}
          </Card>
        </div>

        <div className="space-y-6">
          {Array.isArray(doc.blocks) && (
            <Card title="Preview" actions={<Button variant="ghost" onClick={() => setPreview((p) => !p)}>{preview ? 'Hide' : 'Show'}</Button>}>
              {preview ? (
                <div className="max-h-[70vh] origin-top-left overflow-auto rounded border border-gray-100">
                  <BlockRenderer blocks={doc.blocks} />
                </div>
              ) : <p className="text-sm text-gray-500">{doc.blocks.length} blocks</p>}
            </Card>
          )}
          {!isNew && (
            <Card title="Danger zone">
              <Button variant="danger" onClick={() => confirm(`Delete this ${r.singular.toLowerCase()}?`) && remove.mutate()} loading={remove.isPending}>
                Delete
              </Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
