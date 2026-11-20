/**
 * Bootstrap the first super admin (sign-up is disabled, so this is the only way in).
 *
 *   pnpm --filter @itti/api create-admin -- --email you@ittighana.com --name "Your Name"
 *
 * Prints a password-reset link (and emails it if SMTP is configured).
 */
import { connectDb, disconnectDb, nativeDb } from '@itti/db';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { env } from '../env';
import { auth } from '../services';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
if (!values.email || !values.name) {
  console.error('Usage: create-admin --email <email> --name "<name>"');
  process.exit(1);
}

await connectDb(env.MONGODB_URI);
const existing = await nativeDb().collection('user').findOne({ email: values.email.toLowerCase() });
if (existing) {
  await nativeDb().collection('user').updateOne({ _id: existing._id }, { $set: { role: 'super_admin' } });
  console.log(`✓ ${values.email} already exists, now promoted to super_admin`);
} else {
  await auth().api.createUser({
    body: { email: values.email, name: values.name, password: randomBytes(24).toString('base64url'), role: 'super_admin' as 'admin' },
  });
  console.log(`✓ Created super_admin ${values.email}`);
}
await auth().api.requestPasswordReset({ body: { email: values.email, redirectTo: `${env.ADMIN_PUBLIC_URL}/reset-password` } });
console.log('✓ Password set-up email sent (check the API logs for the link if SMTP is not configured)');
await disconnectDb();
