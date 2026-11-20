import { buildTemplateFields, type ContentType, type LayoutNode, type TemplateInput } from '@itti/schemas';

/**
 * Content templates for news, events, student articles and careers.
 *
 * They're generated from the site's own course page design (WordPress "ITTI Course
 * Template 2"), so every content type shares the same look: a title band, a navy
 * highlight band, tabbed content cards and a sidebar with an image and a call to action.
 * Only the labels and the fields each part reads change.
 */

type Dyn = { $dyn: string; field?: string };
type Section = { heading: string; field: string };
export type ContentTemplateSpec = {
  slug: string;
  title: string;
  contentType: ContentType;
  description: string;
  isDefault?: boolean;
  /** Navy band: label on the left, a record value on the right. */
  band: { label: string; value: Dyn };
  /** Tabs, each with heading + rich-text field pairs. */
  tabs: { title: string; sections: Section[] }[];
  /** Sidebar image (record cover or an image field). */
  sideImage: Dyn;
  cta: { heading: string; text: string; button: string; link?: Dyn | string };
  /** Fields to list even if the layout doesn't show them directly. */
  extraFields?: string[];
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Give every node a fresh id (CSS is scoped by node id) using a per-template prefix. */
function reid(nodes: LayoutNode[], prefix: string): LayoutNode[] {
  let n = 0;
  const walk = (list: LayoutNode[]): LayoutNode[] =>
    list.map((node) => ({ ...node, id: `${prefix}${(n++).toString(36)}`, children: node.children ? walk(node.children) : undefined }));
  return walk(nodes);
}

function find(nodes: LayoutNode[], pred: (n: LayoutNode) => boolean): LayoutNode | undefined {
  for (const n of nodes) {
    if (pred(n)) return n;
    const hit = n.children && find(n.children, pred);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Builds a content template from the course template layout.
 * Expected structure (WordPress "ITTI Course Template 2"):
 *   [0] title band · [1] navy band (label | value) · [2] row: tabs (cards of heading + text) | sidebar (image, CTA box)
 */
export function buildContentTemplate(base: LayoutNode[], spec: ContentTemplateSpec): TemplateInput {
  const [titleBand, navyBand, body] = clone(base);
  if (!titleBand || !navyBand || !body) throw new Error('Unexpected course template structure');

  // Navy band
  const bandHeadings: LayoutNode[] = [];
  const collect = (list: LayoutNode[]) => list.forEach((n) => (n.type === 'heading' ? bandHeadings.push(n) : n.children && collect(n.children)));
  collect([navyBand]);
  const [labelNode, valueNode] = bandHeadings;
  if (labelNode) labelNode.props = { ...labelNode.props, title: spec.band.label };
  if (valueNode) valueNode.props = { title: spec.band.value };

  // Tabs: reuse the first card as the pattern for every card
  const tabs = find([body], (n) => n.type === 'nested-tabs');
  if (!tabs?.children?.length) throw new Error('Course template has no tabs');
  const panePattern = tabs.children[0]!;
  const card = panePattern.children?.[0];
  const headingPattern = card?.children?.find((c) => c.type === 'heading');
  const textPattern = card?.children?.find((c) => c.type === 'text-editor');
  if (!card || !headingPattern || !textPattern) throw new Error('Course template tab card not found');

  tabs.props = { ...tabs.props, tabs: spec.tabs.map((t, i) => ({ tab_title: t.title, _id: `t${i}` })) };
  tabs.children = spec.tabs.map((t) => ({
    ...clone(panePattern),
    children: [
      {
        ...clone(card),
        children: t.sections.flatMap((s) => [
          { ...clone(headingPattern), props: { ...headingPattern.props, title: s.heading } },
          { ...clone(textPattern), props: { editor: { $dyn: 'field', field: s.field } } },
        ]),
      },
    ],
  }));

  // Sidebar: image + call to action
  const image = find([body], (n) => n.type === 'image');
  if (image) image.props = { ...image.props, image: spec.sideImage };
  const ctaHeading = find([body], (n) => n.type === 'heading' && /get started/i.test(String(n.props?.title ?? '')));
  if (ctaHeading) ctaHeading.props = { ...ctaHeading.props, title: spec.cta.heading };
  const ctaText = find([body], (n) => n.type === 'text-editor' && /secure your spot/i.test(String(n.props?.editor ?? '')));
  if (ctaText) ctaText.props = { ...ctaText.props, editor: `<p>${spec.cta.text}</p>` };
  const button = find([body], (n) => n.type === 'button');
  if (button) button.props = { ...button.props, text: spec.cta.button, ...(spec.cta.link ? { link: { url: spec.cta.link } } : {}) };

  const layout = reid([titleBand, navyBand, body], `${spec.contentType.slice(0, 2)}${spec.slug.length.toString(36)}`);
  return {
    title: spec.title,
    slug: spec.slug,
    kind: 'single',
    conditions: [],
    layout,
    status: 'published',
    contentType: spec.contentType,
    fields: buildTemplateFields(spec.contentType, layout, spec.extraFields),
    isDefault: spec.isDefault ?? false,
    description: spec.description,
  };
}

const field = (key: string): Dyn => ({ $dyn: 'field', field: key });

/** The templates added for each content type (courses and the main news layout come from WordPress). */
export const CONTENT_TEMPLATE_SPECS: ContentTemplateSpec[] = [
  {
    slug: 'news-feature',
    title: 'News – Feature',
    contentType: 'news',
    description: 'Story in a card beside a photo, with the publish date in the navy band.',
    band: { label: 'News', value: { $dyn: 'date' } },
    tabs: [{ title: 'Story', sections: [{ heading: 'The story', field: 'body' }] }],
    sideImage: { $dyn: 'featured-image' },
    cta: { heading: 'Study With ITTI', text: 'Applications are open for the next intake.', button: 'Apply Now', link: '/enrollment-apply' },
    extraFields: ['subtitle'],
  },
  {
    slug: 'event-page',
    title: 'Event – Page',
    contentType: 'event',
    isDefault: true,
    description: 'Date in the navy band, description and venue in tabs, register button in the sidebar.',
    band: { label: 'Event', value: field('event_date') },
    tabs: [
      { title: 'About', sections: [{ heading: 'About this event', field: 'event_description' }] },
      { title: 'Time & Venue', sections: [{ heading: 'Time', field: 'event_time' }, { heading: 'Venue', field: 'event_location' }] },
    ],
    sideImage: { $dyn: 'featured-image' },
    cta: { heading: 'Join Us', text: 'Reserve your place today.', button: 'Register', link: field('registration_link') },
    extraFields: ['event_name'],
  },
  {
    slug: 'student-article',
    title: 'Student Article',
    contentType: 'article',
    isDefault: true,
    description: 'Student name in the navy band, introduction and article in tabs, PDF download in the sidebar.',
    band: { label: 'Written by', value: field('author') },
    tabs: [
      { title: 'Introduction', sections: [{ heading: 'Introduction', field: 'introduction' }] },
      { title: 'Article', sections: [{ heading: 'The article', field: 'body' }] },
    ],
    sideImage: field('article_image'),
    cta: { heading: 'Read The Full Article', text: 'Download the complete article as a PDF.', button: 'Download PDF', link: field('article_pdf') },
    extraFields: ['article_title', 'programme'],
  },
  {
    slug: 'career-opening',
    title: 'Career Opening',
    contentType: 'career',
    isDefault: true,
    description: 'Role summary in the navy band; responsibilities, requirements and benefits in tabs; apply button in the sidebar.',
    band: { label: 'The Role', value: field('role_summary') },
    tabs: [
      { title: 'Responsibilities', sections: [{ heading: 'Responsibilities', field: 'responsibilities' }] },
      { title: 'Requirements', sections: [{ heading: 'Requirements', field: 'requirements' }] },
      { title: 'What We Offer', sections: [{ heading: 'What we offer', field: 'benefits' }, { heading: 'How to apply', field: 'how_to_apply' }] },
    ],
    sideImage: { $dyn: 'featured-image' },
    cta: { heading: 'Join Our Team', text: 'Think you are a good fit? We would love to hear from you.', button: 'Apply For This Role', link: field('apply_link') },
  },
];

/** WordPress templates that become content templates (slug prefix → settings). */
export const WORDPRESS_CONTENT_TEMPLATES: { slugPrefix: string; contentType: ContentType; title?: string; description: string; isDefault?: boolean; extraFields?: string[] }[] = [
  { slugPrefix: 'itti-course-template-1', contentType: 'course', title: 'Course – Template 1', description: 'Original course layout with benefits; used by the Foundation Diploma.' },
  { slugPrefix: 'itti-course-template-2', contentType: 'course', title: 'Course – Template 2', description: 'Tabs for overview, curriculum and delivery with a Get Started box.', isDefault: true },
  { slugPrefix: 'itti-course-template-3', contentType: 'course', title: 'Course – Template 3', description: 'Variant used by Professional Development and AI Prompt Engineering.' },
  { slugPrefix: 'news-article', contentType: 'news', title: 'News – Article', description: 'The original news article layout with author and date.', isDefault: true, extraFields: ['body'] },
];
