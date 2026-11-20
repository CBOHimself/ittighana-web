import { SiteSettings } from '../models';
import type { Migration } from './types';

/** Make sure the settings document exists with safe defaults (admins edit it in Settings). */
export const m002: Migration = {
  id: '20261116-02-site-settings',
  description: 'Create default site settings (name, contact, WhatsApp button, watermark)',
  async up({ log, dryRun }) {
    const existing = await SiteSettings.findOne({ key: 'site' }).lean();
    const value = (existing?.value ?? {}) as Record<string, unknown>;
    const defaults: Record<string, unknown> = {
      siteName: 'International Travel and Tourism Institute',
      tagline: 'Launch your career in aviation & hospitality',
      contact: { phone: '+233 54 545 4022', sms: '+233 50 433 9993', email: 'frontdesk@ittighana.com', address: 'Jupiter House, Abofu, Achimota. P.O. Box 13384, Accra Ghana' },
      whatsapp: { enabled: true, number: '233545454022', message: 'Hello ITTI, I would like to know more about your courses.' },
      watermark: { enabled: true, label: 'Built by HostHaus', url: 'https://hosthaus.com' },
      social: {},
      seo: {},
    };
    const missing = Object.fromEntries(Object.entries(defaults).filter(([k]) => value[k] === undefined));
    if (!Object.keys(missing).length) return log('settings already complete');
    log(`adding settings: ${Object.keys(missing).join(', ')}`);
    if (!dryRun) await SiteSettings.updateOne({ key: 'site' }, { $set: { value: { ...missing, ...value } } }, { upsert: true });
  },
};
