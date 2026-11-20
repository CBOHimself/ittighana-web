import { Card, Container, Grid } from '@/components/site/Card';
import { PageHeader } from '@/components/site/PageHeader';
import { api } from '@/lib/api';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Enroll Now' };

type FormSummary = { _id: string; name: string; slug: string; description?: string };

export default async function EnrollIndex() {
  const forms = await api<FormSummary[]>('/forms', { tags: ['form'] });
  if (forms.length === 1) redirect(`/enroll/${forms[0]!.slug}`);
  return (
    <>
      <PageHeader title="Enroll Now" intro="Choose an application form to get started." crumbs={[{ label: 'Enroll Now' }]} />
      <Container>
        <Grid>
          {forms.map((f) => <Card key={f._id} href={`/enroll/${f.slug}`} title={f.name}>{f.description}</Card>)}
        </Grid>
      </Container>
    </>
  );
}
