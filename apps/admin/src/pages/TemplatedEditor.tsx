import {
  CONTENT_TYPE_LABELS,
  type ContentType,
  type TemplateField,
} from '@itti/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { http, HttpError } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import type { Resource } from '@/resources';
import { Alert, Badge, Button, Card, FormField, Input, PageTitle, Select, Spinner, Textarea, toast } from '@/ui';

/**
 * Editor for templated content (courses, news, events, student articles, careers).
 *  1. New records start by choosing a template.
 *  2. The form has the record's core details plus the fields the chosen template shows.
 * Switching template keeps every value (field keys are shared across templates).
 * The API validates field types on save and required fields on publish.
 */

type TemplateSummary = { _id: string; slug: string; title: string; description?: string; isDefault?: boolean; fields: TemplateField[]; preview?: { url: string } };
type ContentTypeInfo = { type: ContentType; singular: string; plural: string; urlPrefix: string; fields: TemplateField[]; templates: TemplateSummary[] };
type Doc = Record<string, unknown> & { _id?: string; status?: string; template?: string | null; fields?: Record<string, unknown> };
type Media = { url: string; alt?: string };

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Core (non-template) details per content type. */
type Core = { key: string; label: string; type: 'text' | 'textarea' | 'date' | 'datetime' | 'select' | 'image' | 'checkbox'; required?: boolean; options?: string[]; hint?: string };
const CORE: Record<ContentType, Core[]> = {
  course: [
    { key: 'summary', label: 'Summary', type: 'textarea', hint: 'Shown on course cards and listings.' },
    { key: 'duration', label: 'Duration', type: 'text', hint: 'e.g. "1 month"' },
    { key: 'mode', label: 'Mode', type: 'select', options: ['', 'in-person', 'online', 'hybrid'] },
    { key: 'cover', label: 'Featured image', type: 'image' },
  ],
  news: [
    { key: 'excerpt', label: 'Excerpt', type: 'textarea', hint: 'Shown in the news list.' },
    { key: 'publishedAt', label: 'Publish date', type: 'date' },
    { key: 'cover', label: 'Featured image', type: 'image' },
  ],
  event: [
    { key: 'start', label: 'Starts', type: 'datetime', required: true },
    { key: 'end', label: 'Ends', type: 'datetime', required: true },
    { key: 'allDay', label: 'All-day event', type: 'checkbox' },
    { key: 'summary', label: 'Summary', type: 'textarea', hint: 'Shown on the calendar.' },
    { key: 'cover', label: 'Featured image', type: 'image' },
  ],
  article: [
    { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
    { key: 'publishedAt', label: 'Publish date', type: 'date' },
    { key: 'cover', label: 'Featured image', type: 'image' },
  ],
  career: [
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'employmentType', label: 'Type', type: 'select', options: ['full-time', 'part-time', 'contract', 'internship', 'volunteer'] },
    { key: 'deadline', label: 'Application deadline', type: 'date' },
    { key: 'summary', label: 'Summary', type: 'textarea' },
    { key: 'cover', label: 'Featured image', type: 'image' },
  ],
};

const toLocal = (v: unknown, withTime: boolean) => {
  if (!v) return '';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '';
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString();
  return withTime ? iso.slice(0, 16) : iso.slice(0, 10);
};
const asMedia = (v: unknown): Media | undefined =>
  typeof v === 'string' && v ? { url: v } : v && typeof v === 'object' && 'url' in v ? (v as Media) : undefined;
const mediaUrl = (url: string) => (url.startsWith('/wp-content/') || url.startsWith('/media/') ? url : url);

export function TemplatedEditor({ r, id }: { r: Resource & { contentType: ContentType }; id?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canPublish = usePermission('content:publish');
  const isNew = !id;
  const type = r.contentType;

  const types = useQuery({ queryKey: ['content-types'], queryFn: () => http<ContentTypeInfo[]>('/admin/templates/content-types') });
  const info = types.data?.find((t) => t.type === type);
  const existing = useQuery({ queryKey: ['doc', r.key, id], queryFn: () => http<Doc>(`/admin/${r.path}/${id}`), enabled: !isNew });

  const [doc, setDoc] = useState<Doc>({ fields: {} });
  const [picked, setPicked] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (existing.data) setDoc({ fields: {}, ...existing.data }); }, [existing.data]);

  const template = useMemo(() => {
    const list = info?.templates ?? [];
    return list.find((t) => t.slug === doc.template) ?? list.find((t) => t.isDefault) ?? list[0];
  }, [info, doc.template]);

  const set = (k: string, v: unknown) => setDoc((d) => ({ ...d, [k]: v }));
  const setField = (k: string, v: unknown) => setDoc((d) => ({ ...d, fields: { ...(d.fields ?? {}), [k]: v } }));

  const onError = (err: unknown) => {
    if (err instanceof HttpError) setErrors(err.fields);
    toast.error(err instanceof Error ? err.message : 'Something went wrong');
  };

  const body = () => {
    const { _id, createdAt, updatedAt, createdBy, updatedBy, __v, deletedAt, ...rest } = doc;
    void _id; void createdAt; void updatedAt; void createdBy; void updatedBy; void __v; void deletedAt;
    const out: Doc = { ...rest };
    // Routed content gets its URL from the slug (events and careers are found by slug).
    if (['course', 'news', 'article'].includes(type) && out.slug) out.path = `${CONTENT_TYPE_LABELS[type].urlPrefix}${out.slug}`.replace(/\/{2,}/g, '/');
    return out;
  };

  const save = useMutation({
    mutationFn: () =>
      isNew ? http<Doc>(`/admin/${r.path}`, { method: 'POST', json: body() }) : http<Doc>(`/admin/${r.path}/${id}`, { method: 'PATCH', json: body() }),
    onSuccess: (saved) => {
      setErrors({});
      qc.invalidateQueries({ queryKey: ['list', r.key] });
      qc.setQueryData(['doc', r.key, saved._id], saved);
      toast.success(`${r.singular} saved`);
      if (isNew) navigate(`/content/${r.key}/${saved._id}`, { replace: true });
    },
    onError,
  });
  const action = useMutation({
    mutationFn: async (a: 'publish' | 'unpublish') => {
      if (a === 'publish') await http(`/admin/${r.path}/${id}`, { method: 'PATCH', json: body() });
      return http<Doc>(`/admin/${r.path}/${id}/${a}`, { method: 'POST' });
    },
    onSuccess: (saved, a) => {
      setErrors({});
      setDoc((d) => ({ ...d, ...saved }));
      qc.setQueryData(['doc', r.key, id], saved);
      toast.success(a === 'publish' ? 'Published' : 'Unpublished');
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => http(`/admin/${r.path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success(`${r.singular} deleted`); navigate(`/content/${r.key}`); },
  });

  if (types.isLoading || (!isNew && existing.isLoading)) return <Spinner />;
  if (!info) return <Alert>Templates could not be loaded. Run the database migrations (pnpm db:migrate).</Alert>;

  /* Step 1 — choose a template */
  if (isNew && !picked) {
    return (
      <>
        <PageTitle title={`New ${r.singular.toLowerCase()}`} subtitle="Choose a template. You can switch later without losing anything you've typed." />
        {info.templates.length === 0 ? (
          <Alert>No templates for {info.plural.toLowerCase()} yet. Run the database migrations first.</Alert>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {info.templates.map((t) => (
              <button
                key={t._id}
                type="button"
                onClick={() => { set('template', t.slug); setPicked(true); }}
                className="rounded-card border border-line bg-surface p-5 text-left shadow-card transition hover:border-primary-500 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-base font-semibold text-text-primary">{t.title}</span>
                  {t.isDefault && <Badge>default</Badge>}
                </div>
                {t.description && <p className="text-sm text-text-primary">{t.description}</p>}
                <p className="mt-3 text-xs text-text-primary">
                  {t.fields.length} fields · {t.fields.filter((f) => f.required).length} required to publish
                </p>
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  /* Step 2 — fill in the details */
  const fields = template?.fields ?? [];
  const groups = [...new Set(fields.map((f) => f.group ?? 'Details'))];
  const title = String(doc.title ?? '');
  const err = (k: string) => errors[k] ?? errors[`fields.${k}`];

  return (
    <>
      <PageTitle
        title={isNew ? `New ${r.singular.toLowerCase()}` : title || r.singular}
        subtitle={`${info.plural} · ${template?.title ?? 'No template'}`}
        actions={
          <>
            {!isNew && r.hasStatus && canPublish && (
              doc.status === 'published'
                ? <Button variant="secondary" onClick={() => action.mutate('unpublish')} loading={action.isPending}>Unpublish</Button>
                : <Button variant="secondary" onClick={() => action.mutate('publish')} loading={action.isPending}>Save & publish</Button>
            )}
            <Button onClick={() => save.mutate()} loading={save.isPending}>Save</Button>
          </>
        }
      />
      {Object.keys(errors).length > 0 && (
        <div className="mb-4"><Alert>Please fix {Object.keys(errors).length === 1 ? 'the highlighted field' : `the ${Object.keys(errors).length} highlighted fields`}.</Alert></div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Title" error={err('title')}>
                <Input value={title} onChange={(e) => { set('title', e.target.value); if (isNew) set('slug', slugify(e.target.value)); }} />
              </FormField>
              <FormField label="Slug" hint={`Web address: ${info.urlPrefix}${String(doc.slug ?? '')}`} error={err('slug')}>
                <Input value={String(doc.slug ?? '')} onChange={(e) => set('slug', slugify(e.target.value))} />
              </FormField>
              {CORE[type].map((c) => (
                <div key={c.key} className={c.type === 'textarea' || c.type === 'image' ? 'sm:col-span-2' : ''}>
                  <CoreInput c={c} value={doc[c.key]} error={err(c.key)} onChange={(v) => set(c.key, v)} />
                </div>
              ))}
            </div>
          </Card>

          {groups.map((g) => (
            <Card key={g} title={g}>
              <div className="space-y-4">
                {fields.filter((f) => (f.group ?? 'Details') === g).map((f) => (
                  <FieldInput key={f.key} def={f} value={doc.fields?.[f.key]} error={err(f.key)} onChange={(v) => setField(f.key, v)} />
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card title="Template">
            <div className="space-y-3">
              <Select
                value={template?.slug ?? ''}
                onChange={(e) => set('template', e.target.value)}
                options={info.templates.map((t) => ({ label: `${t.title}${t.isDefault ? ' (default)' : ''}`, value: t.slug }))}
              />
              {template?.description && <p className="text-sm text-text-primary">{template.description}</p>}
              <p className="text-xs text-text-primary">Switching template keeps all your field values; fields a template doesn't show stay saved.</p>
            </div>
          </Card>
          {!isNew && (
            <Card title="Status">
              <div className="flex items-center justify-between">
                <Badge>{doc.status ?? 'draft'}</Badge>
                {doc.status === 'published' && typeof doc.path === 'string' && (
                  <a href={doc.path} target="_blank" rel="noreferrer" className="text-sm text-primary-500 underline">View on site</a>
                )}
                {doc.status === 'published' && ['event', 'career'].includes(type) && (
                  <a href={`${info.urlPrefix}${String(doc.slug)}`} target="_blank" rel="noreferrer" className="text-sm text-primary-500 underline">View on site</a>
                )}
              </div>
              <p className="mt-3 text-xs text-text-primary">Required fields: {fields.filter((f) => f.required).map((f) => f.label).join(', ') || 'none'}.</p>
            </Card>
          )}
          {!isNew && (
            <Card title="Danger zone">
              <Button variant="danger" onClick={() => confirm(`Delete this ${r.singular.toLowerCase()}?`) && remove.mutate()} loading={remove.isPending}>Delete</Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Label({ text, required }: { text: string; required?: boolean }): ReactNode {
  return required ? `${text} *` : text;
}

function CoreInput({ c, value, error, onChange }: { c: Core; value: unknown; error?: string; onChange: (v: unknown) => void }) {
  const label = String(Label({ text: c.label, required: c.required }));
  switch (c.type) {
    case 'textarea':
      return <FormField label={label} hint={c.hint} error={error}><Textarea rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></FormField>;
    case 'date':
    case 'datetime':
      return (
        <FormField label={label} hint={c.hint} error={error}>
          <Input type={c.type === 'date' ? 'date' : 'datetime-local'} value={toLocal(value, c.type === 'datetime')} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
        </FormField>
      );
    case 'select':
      return <FormField label={label} hint={c.hint} error={error}><Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)} options={(c.options ?? []).map((o) => ({ label: o || '—', value: o }))} /></FormField>;
    case 'checkbox':
      return <label className="flex items-center gap-2 pt-7 text-sm text-text-primary"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
    case 'image':
      return <MediaInput label={label} hint={c.hint} error={error} value={asMedia(value)} onChange={onChange} />;
    default:
      return <FormField label={label} hint={c.hint} error={error}><Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></FormField>;
  }
}

function MediaInput({ label, hint, error, value, onChange }: { label: string; hint?: string; error?: string; value?: Media; onChange: (v: unknown) => void }) {
  return (
    <FormField label={label} hint={hint ?? 'Paste an image address from the Media library (e.g. /wp-content/uploads/2025/11/photo.jpg).'} error={error}>
      <div className="flex items-start gap-3">
        {value?.url && <img src={mediaUrl(value.url)} alt="" className="h-16 w-24 shrink-0 rounded-control border border-line object-cover" />}
        <div className="flex-1 space-y-2">
          <Input value={value?.url ?? ''} placeholder="/wp-content/uploads/…" onChange={(e) => onChange(e.target.value ? { ...(value ?? {}), url: e.target.value } : undefined)} />
          {value?.url && <Input value={value.alt ?? ''} placeholder="Alt text (describe the image)" onChange={(e) => onChange({ ...value, alt: e.target.value })} />}
        </div>
      </div>
    </FormField>
  );
}

function FieldInput({ def, value, error, onChange }: { def: TemplateField; value: unknown; error?: string; onChange: (v: unknown) => void }) {
  const label = def.required ? `${def.label} *` : def.label;
  const hint = def.help ?? (def.maxLength ? `Up to ${def.maxLength} characters` : undefined);
  switch (def.type) {
    case 'richtext':
      return (
        <FormField label={label} hint={hint ?? 'Formatted text. Basic HTML (<p>, <ul>, <strong>, <a>) is supported.'} error={error}>
          <Textarea rows={6} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </FormField>
      );
    case 'textarea':
      return <FormField label={label} hint={hint} error={error}><Textarea rows={3} maxLength={def.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></FormField>;
    case 'image':
    case 'file':
      return <MediaInput label={label} hint={hint} error={error} value={asMedia(value)} onChange={onChange} />;
    case 'gallery':
    case 'list': {
      const items = Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v : (v as Media)?.url ?? '')) : [];
      return (
        <FormField label={label} hint={hint ?? 'One per line.'} error={error}>
          <Textarea
            rows={4}
            value={items.join('\n')}
            onChange={(e) => {
              const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean);
              onChange(def.type === 'gallery' ? lines.map((url) => ({ url })) : lines);
            }}
          />
        </FormField>
      );
    }
    case 'date':
    case 'datetime':
      return (
        <FormField label={label} hint={hint} error={error}>
          <Input type={def.type === 'date' ? 'date' : 'datetime-local'} value={toLocal(value, def.type === 'datetime')} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
        </FormField>
      );
    case 'number':
      return <FormField label={label} hint={hint} error={error}><Input type="number" value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></FormField>;
    case 'link': {
      const url = typeof value === 'string' ? value : (value as { url?: string } | undefined)?.url ?? '';
      return <FormField label={label} hint={hint ?? 'A full address (https://…) or a site path (/contact-us).'} error={error}><Input value={url} onChange={(e) => onChange(e.target.value || undefined)} /></FormField>;
    }
    default:
      return <FormField label={label} hint={hint} error={error}><Input maxLength={def.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></FormField>;
  }
}
