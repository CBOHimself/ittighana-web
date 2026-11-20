import { createEvents, type EventAttributes } from 'ics';

type CalEvent = {
  _id: unknown;
  title: string;
  slug: string;
  summary?: string | null;
  start: Date;
  end: Date;
  allDay?: boolean | null;
  location?: string | null;
  rrule?: string | null;
};

const parts = (d: Date, allDay: boolean) =>
  (allDay
    ? [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
    : [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()]) as EventAttributes['start'];

export function toIcs(events: CalEvent[], webUrl: string, calName = 'ITTI Ghana Events') {
  const attrs: EventAttributes[] = events.map((e) => {
    const allDay = Boolean(e.allDay);
    return {
      uid: `${String(e._id)}@ittighana.com`,
      title: e.title,
      description: e.summary ?? undefined,
      location: e.location ?? undefined,
      url: `${webUrl.replace(/\/$/, '')}/events/${e.slug}`,
      start: parts(new Date(e.start), allDay),
      startInputType: 'utc',
      startOutputType: 'utc',
      end: parts(new Date(e.end), allDay),
      endInputType: 'utc',
      endOutputType: 'utc',
      recurrenceRule: e.rrule ?? undefined,
      calName,
      productId: 'ittighana.com/events',
    } as EventAttributes;
  });
  const { error, value } = createEvents(attrs);
  if (error) throw error;
  return value ?? '';
}
