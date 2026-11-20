const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const INLINE_TOGGLE = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'span', 'a', 'small', 'sup', 'sub']);

/**
 * Repairs malformed HTML from WordPress content so the server markup matches what the
 * browser parses (otherwise React hydration fails). Closes unclosed tags, drops stray
 * closers, and treats a re-opened inline tag (`<b>x<b>`) as the missing closer.
 */
export function balanceHtml(html: string): string {
  const stack: string[] = [];
  const out = html.replace(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g, (m, close: string, rawName: string, rest: string) => {
    if (!rawName) return m;
    const name = rawName.toLowerCase();
    if (VOID.has(name) || /\/\s*$/.test(rest)) return m;
    if (close) {
      const at = stack.lastIndexOf(name);
      if (at < 0) return '';
      const closing = stack.splice(at).reverse().map((t) => `</${t}>`).join('');
      return closing;
    }
    if (INLINE_TOGGLE.has(name) && name !== 'a' && name !== 'span' && stack[stack.length - 1] === name && !rest.trim()) {
      stack.pop();
      return `</${name}>`;
    }
    stack.push(name);
    return m;
  });
  return out + stack.reverse().map((t) => `</${t}>`).join('');
}
