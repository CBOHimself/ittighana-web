'use client';

import type { FormField } from '@itti/schemas';
import { useMemo, useState } from 'react';
import { Alert, Field, Input, inputCls, SubmitButton, Textarea, Turnstile } from './ui';

type Props = {
  apiUrl: string;
  slug: string;
  fields: FormField[];
  submitLabel?: string;
  /** e.g. { course: "web-development" } from ?course= */
  context?: Record<string, string>;
};

/** Renders any form built in the admin Form Builder and submits it as multipart. */
export function DynamicForm({ apiUrl, slug, fields, submitLabel = 'Submit', context = {} }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ pending: boolean; done?: string; error?: string; fieldErrors?: Record<string, string> }>({ pending: false });

  const visible = useMemo(
    () => fields.filter((f) => !f.showIf || values[f.showIf.field] === f.showIf.equals),
    [fields, values],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const [k, v] of Object.entries(context)) fd.set(k, v);
    setState({ pending: true });
    const res = await fetch(`${apiUrl}/v1/forms/${slug}/submissions`, { method: 'POST', body: fd });
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; issues?: Array<{ path: (string | number)[]; message: string }> };
    if (res.ok) {
      setState({ pending: false, done: data.message ?? 'Thank you!' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const fieldErrors = Object.fromEntries((data.issues ?? []).map((i) => [String(i.path[0]), i.message]));
    setState({ pending: false, error: data.error ?? 'Please check the form and try again.', fieldErrors });
  }

  if (state.done) return <Alert kind="success">{state.done}</Alert>;

  const track = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" encType="multipart/form-data" noValidate={false}>
      {visible.map((f) => {
        const span = f.width === 'half' ? '' : 'sm:col-span-2';
        const err = state.fieldErrors?.[f.name];
        const common = { name: f.name, required: f.required, placeholder: f.placeholder, onChange: track(f.name) };

        switch (f.type) {
          case 'heading':
            return <h3 key={f.id} className="mt-4 text-xl font-semibold text-brand-ink sm:col-span-2">{f.label}</h3>;
          case 'paragraph':
            return <p key={f.id} className="text-gray-700 sm:col-span-2">{f.label}</p>;
          case 'textarea':
            return <Field key={f.id} className={span} label={f.label} required={f.required} help={f.help} error={err}><Textarea {...common} minLength={f.validation?.min} maxLength={f.validation?.max} /></Field>;
          case 'select':
            return (
              <Field key={f.id} className={span} label={f.label} required={f.required} help={f.help} error={err}>
                <select {...common} className={inputCls} defaultValue="">
                  <option value="" disabled>Select…</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            );
          case 'radio':
            return (
              <fieldset key={f.id} className={span}>
                <legend className="mb-1.5 text-sm font-medium text-gray-700">{f.label}{f.required && <span className="text-red-600"> *</span>}</legend>
                <div className="flex flex-wrap gap-4">
                  {f.options?.map((o) => (
                    <label key={o.value} className="flex items-center gap-2"><input type="radio" {...common} value={o.value} /> {o.label}</label>
                  ))}
                </div>
                {err && <span className="mt-1 block text-xs text-red-600">{err}</span>}
              </fieldset>
            );
          case 'checkboxGroup':
            return (
              <fieldset key={f.id} className={span}>
                <legend className="mb-1.5 text-sm font-medium text-gray-700">{f.label}</legend>
                <div className="flex flex-wrap gap-4">
                  {f.options?.map((o) => (
                    <label key={o.value} className="flex items-center gap-2"><input type="checkbox" name={f.name} value={o.value} /> {o.label}</label>
                  ))}
                </div>
              </fieldset>
            );
          case 'checkbox':
            return (
              <label key={f.id} className={`flex items-start gap-3 ${span}`}>
                <input type="checkbox" name={f.name} value="true" required={f.required} className="mt-1" />
                <span className="text-sm text-gray-700">{f.label}{f.required && <span className="text-red-600"> *</span>}</span>
              </label>
            );
          case 'file':
            return (
              <Field key={f.id} className={span} label={f.label} required={f.required} help={f.help ?? (f.validation?.maxSizeMb ? `Max ${f.validation.maxSizeMb}MB` : undefined)} error={err}>
                <Input type="file" name={f.name} required={f.required} accept={f.validation?.accept?.join(',')} />
              </Field>
            );
          default: {
            const type = { email: 'email', phone: 'tel', number: 'number', date: 'date', text: 'text' }[f.type] ?? 'text';
            return (
              <Field key={f.id} className={span} label={f.label} required={f.required} help={f.help} error={err}>
                <Input {...common} type={type} min={f.validation?.min} max={f.validation?.max} pattern={f.validation?.pattern} />
              </Field>
            );
          }
        }
      })}
      <div className="sm:col-span-2"><Turnstile /></div>
      {state.error && <div className="sm:col-span-2"><Alert kind="error">{state.error}</Alert></div>}
      <div className="sm:col-span-2"><SubmitButton pending={state.pending}>{submitLabel}</SubmitButton></div>
    </form>
  );
}
