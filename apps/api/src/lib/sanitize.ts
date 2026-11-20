import sanitizeHtml from 'sanitize-html';

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'figure',
    'figcaption',
    'iframe',
    'span',
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class', 'style', 'id'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title'],
  },
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com', 'www.google.com'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

export const cleanHtml = (html: string) => sanitizeHtml(html, options);

/** Sanitise every HTML field inside a blocks array (richText, twoColumn, faq answers…). */
export function sanitizeBlocks<T>(blocks: T): T {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b: Record<string, unknown>) => {
    const copy: Record<string, unknown> = { ...b };
    if (typeof copy.html === 'string') copy.html = cleanHtml(copy.html);
    if (Array.isArray(copy.items)) {
      copy.items = copy.items.map((it: Record<string, unknown>) =>
        typeof it?.answer === 'string' ? { ...it, answer: cleanHtml(it.answer) } : it,
      );
    }
    return copy;
  }) as T;
}
