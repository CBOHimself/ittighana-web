import nodemailer, { type Transporter } from 'nodemailer';

export type MailerConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type Mail = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

/** SMTP mailer (cPanel mail in production). */
export class Mailer {
  private transport: Transporter | null = null;

  constructor(private readonly cfg: MailerConfig) {}

  private get t() {
    this.transport ??= nodemailer.createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      auth: this.cfg.user ? { user: this.cfg.user, pass: this.cfg.pass } : undefined,
    });
    return this.transport;
  }

  /** Never throws: a failed email is logged so it can't break a submission. */
  async send(mail: Mail): Promise<boolean> {
    if (!this.cfg.host || !this.cfg.pass) {
      const links = [...mail.html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => m[1]);
      console.info('[mail:dev]', mail.subject, '→', mail.to);
      for (const link of links) console.info('[mail:dev]', link);
      return false;
    }
    try {
      await this.t.sendMail({ from: this.cfg.from, ...mail, text: mail.text ?? stripHtml(mail.html) });
      return true;
    } catch (err) {
      console.error('[mail:error]', mail.subject, err);
      return false;
    }
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
