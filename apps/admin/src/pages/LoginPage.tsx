import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { authClient } from '@/lib/auth';
import { Alert, Button, Card, Input } from '@/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const next = params.get('next') ?? '/';

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(undefined);
    const { data, error } = await authClient.signIn.email({ email: String(f.get('email')), password: String(f.get('password')) });
    setPending(false);
    if (error) return setError(error.message ?? 'Sign in failed');
    if ((data as { twoFactorRedirect?: boolean })?.twoFactorRedirect) return setStep('totp');
    navigate(next);
  }

  async function onTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code'));
    setPending(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
    setPending(false);
    if (error) return setError(error.message ?? 'Invalid code');
    navigate(next);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}itti-logo.png`} alt="International Travel and Tourism Institute" className="h-24 w-auto" />
          <div className="text-2xl font-bold text-primary-600">ITTI Admin</div>
        </div>
        <Card>
          {step === 'password' ? (
            <form onSubmit={onPassword} className="space-y-4">
              <Input label="Email" name="email" type="email" required autoComplete="username" />
              <Input label="Password" name="password" type="password" required autoComplete="current-password" />
              {error && <Alert>{error}</Alert>}
              <Button type="submit" loading={pending} className="w-full">Sign in</Button>
              <p className="text-center text-xs text-text-primary">
                Staff accounts are created by an administrator. Forgot your password? Ask an admin to send a reset link.
              </p>
            </form>
          ) : (
            <form onSubmit={onTotp} className="space-y-4">
              <p className="text-sm text-gray-600">Enter the 6-digit code from your authenticator app.</p>
              <Input label="Code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus />
              {error && <Alert>{error}</Alert>}
              <Button type="submit" loading={pending} className="w-full">Verify</Button>
            </form>
          )}
        </Card>
        <p className="mt-6 text-center text-xs text-text-primary">
          <a href="/" className="underline">Back to ittighana.com</a> · Built by HostHaus
        </p>
      </div>
    </div>
  );
}
