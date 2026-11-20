import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { authClient } from '@/lib/auth';
import { Alert, Button, Card, FormField, Input } from '@/ui';

/** Used for invitations and forgotten passwords (link from email). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const token = params.get('token') ?? '';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) return setError('Passwords do not match');
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: String(f.get('password')), token });
    setPending(false);
    if (error) return setError(error.message ?? 'Could not set password');
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card title="Set your password" className="w-full max-w-sm">
        {!token ? (
          <Alert>This link is invalid or has expired.</Alert>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField label="New password" hint="At least 10 characters"><Input name="password" type="password" minLength={10} required autoComplete="new-password" /></FormField>
            <FormField label="Confirm password"><Input name="confirm" type="password" minLength={10} required autoComplete="new-password" /></FormField>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" loading={pending} className="w-full">Save password</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
