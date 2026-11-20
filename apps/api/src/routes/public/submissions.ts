import { ContactMessage, Course, Career, Event, Form, FormSubmission, Media, SiteSettings, Space, SpaceBooking } from '@itti/db';
import { templates } from '@itti/email';
import { makeKey, MAX_UPLOAD_MB, PRIVATE_ALLOWED, trustedMime } from '@itti/media';
import { bookingRequest, buildSubmissionValidator, contactMessageInput, type FormField } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { env } from '../../env';
import { badRequest, clientIp, conflict, notFound } from '../../lib/http';
import { verifyTurnstile } from '../../lib/turnstile';
import { rateLimit } from '../../middleware/rate-limit';
import { adminUrl, mailer, storage } from '../../services';
import type { AppEnv } from '../../types';

const formLimit = rateLimit({ windowMs: 10 * 60_000, max: 10, key: 'forms' });

async function notifyList(extra: string[] = []) {
  const settings = await SiteSettings.findOne({ key: 'site' }).lean();
  const fromSettings = ((settings?.value as { contact?: { notifyEmails?: string[] } })?.contact?.notifyEmails ?? []);
  return [...new Set([...extra, ...fromSettings, env.ADMIN_NOTIFY_EMAIL].filter(Boolean))];
}

const fmt = (d: Date) =>
  d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Accra' });

/** Public write endpoints: contact, space bookings, application forms. */
export const submissionRoutes = new Hono<AppEnv>()
  /* Contact Us → inbox + email -------------------------------------- */
  .post('/contact', formLimit, zValidator('json', contactMessageInput), async (c) => {
    const body = c.req.valid('json');
    if (body.website) return c.json({ ok: true }); // honeypot: pretend success
    const ip = clientIp(c.req.raw.headers);
    if (!(await verifyTurnstile(body.turnstileToken, ip))) throw badRequest('Verification failed');

    const { website: _hp, turnstileToken: _t, ...data } = body;
    const msg = await ContactMessage.create({ ...data, ip });

    const to = await notifyList();
    await Promise.all([
      to.length && mailer.send({ to, replyTo: data.email, ...templates.contactToAdmin(data, adminUrl(`/inbox/${msg._id}`)) }),
      mailer.send({ to: data.email, ...templates.contactAutoReply(data.name) }),
    ]);
    return c.json({ ok: true }, 201);
  })

  /* Spaces → booking request ---------------------------------------- */
  .post('/spaces/:slug/bookings', formLimit, zValidator('json', bookingRequest), async (c) => {
    const body = c.req.valid('json');
    const ip = clientIp(c.req.raw.headers);
    if (!(await verifyTurnstile(body.turnstileToken, ip))) throw badRequest('Verification failed');

    const space = await Space.findOne({ slug: c.req.param('slug'), status: 'published', deletedAt: null }).lean();
    if (!space) throw notFound('Space');
    if (body.attendees > space.capacity) throw badRequest(`This space holds up to ${space.capacity} people`);
    if (body.start.getTime() < Date.now()) throw badRequest('Choose a time in the future');
    const minutes = (body.end.getTime() - body.start.getTime()) / 60_000;
    if (minutes < (space.minBookingMinutes ?? 60)) throw badRequest(`Minimum booking is ${space.minBookingMinutes} minutes`);

    const clash = await SpaceBooking.exists({
      spaceId: space._id,
      status: 'approved',
      deletedAt: null,
      start: { $lt: body.end },
      end: { $gt: body.start },
    });
    if (clash) throw conflict('That time is already booked. Please choose another slot.');

    const { turnstileToken: _t, ...data } = body;
    const booking = await SpaceBooking.create({
      ...data,
      spaceId: space._id,
      status: space.requiresApproval ? 'pending' : 'approved',
    });

    const when = `${fmt(body.start)} – ${fmt(body.end)}`;
    const to = await notifyList();
    await Promise.all([
      to.length &&
        mailer.send({
          to,
          ...templates.bookingToAdmin(
            { Space: space.name, When: when, Name: data.name, Email: data.email, Phone: data.phone, Attendees: data.attendees, Purpose: data.purpose },
            adminUrl(`/campus/bookings/${booking._id}`),
          ),
        }),
      mailer.send({ to: data.email, ...templates.bookingReceived(data.name, space.name, when) }),
    ]);
    return c.json({ ok: true, status: booking.status }, 201);
  })

  /* Enroll Now / Apply → form submission (multipart) ----------------- */
  .post('/forms/:slug/submissions', formLimit, async (c) => {
    const form = await Form.findOne({ slug: c.req.param('slug'), status: 'published', deletedAt: null }).lean();
    if (!form) throw notFound('Form');
    const settings = (form.settings ?? {}) as {
      opensAt?: string;
      closesAt?: string;
      notifyEmails?: string[];
      confirmationMessage?: string;
      sendConfirmationEmail?: boolean;
    };
    const now = Date.now();
    if ((settings.opensAt && new Date(settings.opensAt).getTime() > now) || (settings.closesAt && new Date(settings.closesAt).getTime() < now)) {
      throw badRequest('This form is not currently accepting submissions');
    }

    const body = await c.req.parseBody({ all: true });
    const ip = clientIp(c.req.raw.headers);
    if (!(await verifyTurnstile(body.turnstileToken as string | undefined, ip))) throw badRequest('Verification failed');

    const fields = form.fields as FormField[];
    // Normalise multipart values: arrays for checkboxGroup, strings otherwise.
    const raw: Record<string, unknown> = {};
    for (const f of fields) {
      const v = body[f.name];
      if (f.type === 'checkboxGroup') raw[f.name] = v === undefined ? [] : ([] as unknown[]).concat(v);
      else if (f.type !== 'file') raw[f.name] = Array.isArray(v) ? v[0] : v;
    }
    const parsed = buildSubmissionValidator(fields).safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Please check the highlighted fields', issues: parsed.error.issues }, 422);
    }

    // Files → private storage
    const files: Array<{ field: string; mediaId: string; originalName: string; mime: string; size: number }> = [];
    for (const f of fields.filter((x) => x.type === 'file')) {
      const list = ([] as unknown[]).concat(body[f.name] ?? []).filter((x): x is File => x instanceof File && x.size > 0);
      if (f.required && list.length === 0) return c.json({ error: `${f.label} is required` }, 422);
      for (const file of list) {
        const maxMb = f.validation?.maxSizeMb ?? MAX_UPLOAD_MB.document;
        if (file.size > maxMb * 1024 * 1024) return c.json({ error: `${f.label}: file is larger than ${maxMb}MB` }, 422);
        const buf = Buffer.from(await file.arrayBuffer());
        const mime = trustedMime(file.type, buf, f.validation?.accept?.length ? f.validation.accept : PRIVATE_ALLOWED);
        if (!mime) return c.json({ error: `${f.label}: file type not allowed` }, 422);
        const key = makeKey(file.name, undefined, `applications/${form.slug}`);
        const stored = await storage.put(key, buf, 'private');
        const media = await Media.create({
          path: key,
          visibility: 'private',
          originalName: file.name,
          mime,
          size: stored.size,
          folder: `applications/${form.slug}`,
        });
        files.push({ field: f.name, mediaId: String(media._id), originalName: file.name, mime, size: stored.size });
      }
    }

    const data = parsed.data as Record<string, unknown>;
    const pick = (...keys: string[]) => keys.map((k) => data[k]).find((v) => typeof v === 'string' && v) as string | undefined;
    const applicant = {
      name: pick('fullName', 'name', 'full_name') ?? [pick('firstName', 'first_name'), pick('lastName', 'surname', 'last_name')].filter(Boolean).join(' '),
      email: pick('email', 'emailAddress'),
      phone: pick('phone', 'phoneNumber', 'telephone'),
    };

    // Optional context: ?course=slug | ?career=slug | ?event=slug
    const ctxKind = (['course', 'career', 'event'] as const).find((k) => typeof body[k] === 'string' && body[k]);
    let context: { kind: string; refId: unknown; title: string } | undefined;
    if (ctxKind) {
      const M = { course: Course, career: Career, event: Event }[ctxKind];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ref = await (M as any).findOne({ slug: body[ctxKind], deletedAt: null }, 'title').lean();
      if (ref) context = { kind: ctxKind, refId: ref._id, title: ref.title };
    }

    const submission = await FormSubmission.create({
      formId: form._id,
      context,
      data,
      files,
      applicant,
      ip,
      userAgent: c.req.header('user-agent'),
    });

    const to = await notifyList(settings.notifyEmails);
    const summary: Record<string, unknown> = { Applicant: applicant.name, Email: applicant.email, Phone: applicant.phone };
    if (context) summary[context.kind[0]!.toUpperCase() + context.kind.slice(1)] = context.title;
    await Promise.all([
      to.length && mailer.send({ to, ...templates.applicationToAdmin(form.name, summary, adminUrl(`/applicants/${submission._id}`)) }),
      settings.sendConfirmationEmail !== false &&
        applicant.email &&
        mailer.send({
          to: applicant.email,
          ...templates.applicationConfirmation(applicant.name || 'applicant', form.name, settings.confirmationMessage ?? 'We have received your application.'),
        }),
    ]);

    return c.json({ ok: true, message: settings.confirmationMessage ?? 'Thank you. We have received your application.' }, 201);
  });
