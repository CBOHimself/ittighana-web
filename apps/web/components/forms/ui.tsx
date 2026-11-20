'use client';

import Script from 'next/script';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-2.5 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-gray-50';

export function Field({ label, required, help, error, children, className = '' }: { label: string; required?: boolean; help?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {help && !error && <span className="mt-1 block text-xs text-gray-600">{help}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ''}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={5} {...p} className={`${inputCls} ${p.className ?? ''}`} />;

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="w-full rounded-md bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60 sm:w-auto">
      {pending ? 'Sending…' : children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: 'success' | 'error'; children: ReactNode }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-md p-4 text-sm ${kind === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
      {children}
    </div>
  );
}

/** Cloudflare Turnstile (only rendered when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set). */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-response-field-name="turnstileToken" />
    </>
  );
}

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; issues?: Array<{ path: (string | number)[]; message: string }> };
  return { ok: res.ok, status: res.status, data };
}
