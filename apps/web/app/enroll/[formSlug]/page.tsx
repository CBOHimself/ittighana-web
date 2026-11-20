import { DynamicForm } from '@/components/forms/DynamicForm';
import { PageHeader } from '@/components/site/PageHeader';
import { apiOrNull, publicApiUrl } from '@/lib/api';
import type { PublicForm } from '@/lib/types';
import type { FormField } from '@itti/schemas';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ formSlug: string }>; searchParams: Promise<Record<string, string | undefined>> };
const load = (slug: string) => apiOrNull<PublicForm>(`/forms/${slug}`, { tags: ['form', `form:${slug}`], revalidate: 300 });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await load((await params).formSlug);
  return f ? { title: f.name, description: f.description } : {};
}

export default async function EnrollFormPage({ params, searchParams }: Props) {
  const form = await load((await params).formSlug);
  if (!form) notFound();
  const sp = await searchParams;
  const context = Object.fromEntries((['course', 'career', 'event'] as const).filter((k) => sp[k]).map((k) => [k, sp[k]!]));

  return (
    <>
      <PageHeader title={form.name} intro={form.description} crumbs={[{ label: 'Enroll Now', href: '/enroll' }, { label: form.name }]} />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {form.open ? (
          <DynamicForm apiUrl={publicApiUrl} slug={form.slug} fields={form.fields as FormField[]} submitLabel={form.settings.submitLabel} context={context} />
        ) : (
          <p className="rounded-lg bg-gray-50 p-6 text-center text-gray-700">This form is not accepting applications right now.</p>
        )}
      </div>
    </>
  );
}
