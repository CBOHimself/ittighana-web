/** HTML email templates (inline styles for mail clients). Brand colours: update BRAND. */
const BRAND = { primary: '#002147', link: '#3277ae', site: 'https://www.ittighana.com' };

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c] ?? c);

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:${BRAND.primary};color:#fff;padding:20px 28px;font-size:18px;font-weight:bold">ITTI Ghana</td></tr>
<tr><td style="padding:28px"><h2 style="margin:0 0 16px;font-size:20px">${esc(title)}</h2>${body}</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">ITTI Ghana · <a href="${BRAND.site}" style="color:${BRAND.link}">ittighana.com</a></td></tr>
</table></td></tr></table></body></html>`;
}

function table(rows: Record<string, unknown>) {
  const tr = Object.entries(rows)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0">${esc(
          Array.isArray(v) ? v.join(', ') : v,
        )}</td></tr>`,
    )
    .join('');
  return `<table cellpadding="0" cellspacing="0" style="font-size:14px">${tr}</table>`;
}

const p = (html: string) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${html}</p>`;
const button = (label: string, href: string) =>
  `<p style="margin-top:20px"><a href="${esc(href)}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(label)}</a></p>`;

export const templates = {
  contactToAdmin: (
    m: { name: string; email: string; phone?: string; subject?: string; message: string },
    adminUrl: string,
  ) => ({
    subject: `New enquiry: ${m.subject || m.name}`,
    html: layout(
      'New contact message',
      table({ Name: m.name, Email: m.email, Phone: m.phone, Subject: m.subject }) +
        `<div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:6px;white-space:pre-wrap">${esc(m.message)}</div>` +
        button('Open inbox', adminUrl),
    ),
  }),
  contactAutoReply: (name: string) => ({
    subject: 'We received your message: ITTI Ghana',
    html: layout(
      `Thank you, ${name}`,
      p('We have received your message and a member of our team will get back to you shortly.'),
    ),
  }),
  applicationToAdmin: (formName: string, summary: Record<string, unknown>, adminUrl: string) => ({
    subject: `New application: ${formName}`,
    html: layout(`New application: ${formName}`, table(summary) + button('Review applicant', adminUrl)),
  }),
  applicationConfirmation: (name: string, formName: string, message: string) => ({
    subject: `Application received: ${formName}`,
    html: layout(`Thank you, ${name}`, p(esc(message)) + p(`Form: <strong>${esc(formName)}</strong>`)),
  }),
  bookingToAdmin: (rows: Record<string, unknown>, adminUrl: string) => ({
    subject: `New space booking request: ${String(rows['Space'] ?? '')}`,
    html: layout('New booking request', table(rows) + button('Review booking', adminUrl)),
  }),
  bookingReceived: (name: string, space: string, when: string) => ({
    subject: `Booking request received: ${space}`,
    html: layout(
      `Thank you, ${name}`,
      p(`We have received your request to book <strong>${esc(space)}</strong> for ${esc(when)}. We'll confirm by email.`),
    ),
  }),
  bookingStatus: (
    name: string,
    space: string,
    when: string,
    status: 'approved' | 'declined' | 'cancelled',
    note?: string,
  ) => ({
    subject: `Your booking for ${space} has been ${status}`,
    html: layout(
      `Booking ${status}`,
      p(`Hi ${esc(name)},`) +
        p(`Your booking for <strong>${esc(space)}</strong> on ${esc(when)} has been <strong>${status}</strong>.`) +
        (note ? p(esc(note)) : ''),
    ),
  }),
  magicLink: (url: string) => ({
    subject: 'Your ITTI admin sign-in link',
    html: layout('Sign in', p('Click the button below to sign in. The link expires in 5 minutes.') + button('Sign in', url)),
  }),
  resetPassword: (url: string) => ({
    subject: 'Reset your ITTI admin password',
    html: layout('Reset password', p('Use the button below to choose a new password.') + button('Reset password', url)),
  }),
  invite: (url: string, role: string) => ({
    subject: 'You have been invited to the ITTI Ghana admin portal',
    html: layout(
      'Admin portal invitation',
      p(`You have been invited as <strong>${esc(role)}</strong>. Use the button below to set your password.`) +
        button('Accept invitation', url),
    ),
  }),
};
