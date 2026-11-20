'use client';

import type { LayoutNode, NavItem } from '@itti/schemas';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ─── Tabs (children are the panels) ──────────────────────────────────── */
export function TabsClient({ titles, panels, direction }: { titles: string[]; panels: ReactNode[]; direction?: string }) {
  const [active, setActive] = useState(0);
  const vertical = direction === 'inline-start' || direction === 'inline-end';
  return (
    <div className="w-tabs" style={vertical ? { display: 'flex', gap: 20 } : undefined}>
      <div className="w-tabs-heading" role="tablist" style={vertical ? { flexDirection: 'column' } : undefined}>
        {titles.map((t, i) => (
          <button key={i} type="button" role="tab" className="w-tab" aria-selected={active === i} onClick={() => setActive(i)}>
            {t}
          </button>
        ))}
      </div>
      <div className="w-tabs-content" style={{ flex: 1 }}>
        {panels.map((panel, i) => (
          <div key={i} role="tabpanel" className="w-tab-panel" hidden={active !== i}>
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Carousel (image + testimonial) ──────────────────────────────────── */
export function CarouselClient({ slides, perView = 1, autoplay = true, arrows = true, dots = true, interval = 5000 }: { slides: ReactNode[]; perView?: number; autoplay?: boolean; arrows?: boolean; dots?: boolean; interval?: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pages = Math.max(1, slides.length - perView + 1);
  const go = (i: number) => {
    const n = (i + pages) % pages;
    setIndex(n);
    const el = track.current;
    const slide = el?.children[n] as HTMLElement | undefined;
    if (el && slide) el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  };
  useEffect(() => {
    if (!autoplay || pages < 2) return;
    const t = setInterval(() => go(index + 1), interval);
    return () => clearInterval(t);
  });
  return (
    <div className="w-carousel" style={{ ['--slides' as string]: perView }}>
      <div className="w-carousel-track" ref={track}>
        {slides.map((s, i) => (
          <div key={i} className="w-carousel-slide">
            {s}
          </div>
        ))}
      </div>
      {arrows && pages > 1 && (
        <>
          <button type="button" className="w-carousel-nav w-carousel-prev" aria-label="Previous" onClick={() => go(index - 1)}>
            ‹
          </button>
          <button type="button" className="w-carousel-nav w-carousel-next" aria-label="Next" onClick={() => go(index + 1)}>
            ›
          </button>
        </>
      )}
      {dots && pages > 1 && (
        <div className="w-carousel-dots">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" aria-label={`Slide ${i + 1}`} aria-current={i === index} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Counter (counts up when visible) ────────────────────────────────── */
export function CounterClient({ start = 0, end, prefix = '', suffix = '', duration = 2000, separator = ',', title }: { start?: number; end: number; prefix?: string; suffix?: string; duration?: number; separator?: string; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(end);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / duration);
        setValue(Math.round(start + (end - start) * k));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      setValue(start);
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [start, end, duration]);
  const num = separator ? value.toLocaleString('en-US').replace(/,/g, separator) : String(value);
  return (
    <div className="w-counter" ref={ref}>
      <div className="w-counter-number">
        {prefix}
        {num}
        {suffix}
      </div>
      {title && <div className="w-counter-title">{title}</div>}
    </div>
  );
}

/* ─── Countdown ───────────────────────────────────────────────────────── */
export function CountdownClient({ due, labels, showSeconds }: { due?: string; labels: [string, string, string, string]; showSeconds: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = due ? new Date(due.replace(' ', 'T')).getTime() : 0;
  const diff = now === null ? 0 : Math.max(0, target - now);
  const parts = [Math.floor(diff / 864e5), Math.floor(diff / 36e5) % 24, Math.floor(diff / 6e4) % 60, Math.floor(diff / 1e3) % 60];
  return (
    <div className="w-cd">
      {parts.slice(0, showSeconds ? 4 : 3).map((v, i) => (
        <div key={i} className="w-cd-item">
          <span className="w-cd-digits">{String(v).padStart(2, '0')}</span>
          <span className="w-cd-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Navigation menu (dropdowns + mobile toggle) ─────────────────────── */
export function NavMenuClient({ items, path: initialPath, toggle = 'tablet' }: { items: NavItem[]; path: string; toggle?: string }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState(initialPath);
  useEffect(() => setPath(window.location.pathname.replace(/\/$/, '') || '/'), []);
  const active = (href: string) => (href === '/' ? path === '/' : href !== '#' && path.startsWith(href));
  return (
    <nav className={`w-nav toggle-${toggle === 'mobile' ? 'mobile' : 'tablet'} ${open ? 'is-open' : ''}`} aria-label="Main">
      <button type="button" className="w-nav-toggle" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
        <i className={open ? 'fas fa-times' : 'fas fa-bars'} aria-hidden />
      </button>
      <ul className="w-nav-list">
        {items.map((it, i) => (
          <li key={i} className="w-nav-item">
            <a href={it.href} className="w-nav-link" aria-current={active(it.href) ? 'page' : undefined}>
              {it.label}
              {it.children?.length ? <i className="fas fa-chevron-down" style={{ fontSize: '.7em' }} aria-hidden /> : null}
            </a>
            {it.children?.length ? (
              <ul className="w-nav-dropdown">
                {it.children.map((c, j) => (
                  <li key={j}>
                    <a href={c.href} aria-current={active(c.href) ? 'page' : undefined}>
                      {c.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ─── Floating WhatsApp chat ("contact buttons") ─────────────────────── */
export function ContactButtonsClient({ name, subtitle, avatar, message, cta, phone }: { name?: string; subtitle?: string; avatar?: string; message?: string; cta?: string; phone: string }) {
  const [open, setOpen] = useState(false);
  const digits = phone.replace(/\D/g, '');
  return (
    <div className="w-floating-chat">
      {open && (
        <div className="w-floating-panel" role="dialog" aria-label="Chat with us">
          <div className="w-floating-top">
            {avatar && <img src={avatar} alt="" />}
            <div>
              <strong>{name}</strong>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{subtitle}</div>
            </div>
          </div>
          <div className="w-floating-body">
            <div className="w-floating-bubble">
              <strong>{name}</strong>
              <div>{message}</div>
            </div>
          </div>
          <a className="w-floating-send" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
            <i className="fab fa-whatsapp" aria-hidden /> {cta ?? 'Start chat'}
          </a>
        </div>
      )}
      <button type="button" className="w-floating-btn" aria-label="Open WhatsApp chat" onClick={() => setOpen((o) => !o)}>
        <i className={open ? 'fas fa-times' : 'fab fa-whatsapp'} aria-hidden />
      </button>
    </div>
  );
}

/* ─── Popups: any link to #popup-<id> opens the popup template ────────── */
export function PopupHost({ popups }: { popups: Array<{ id: string; content: ReactNode }> }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href^="#popup-"]');
      if (!a) return;
      e.preventDefault();
      setOpen(a.getAttribute('href')!.slice(7));
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const p = popups.find((x) => x.id === open);
  if (!p) return null;
  return (
    <div className="w-popup" onClick={() => setOpen(null)}>
      <div className="w-popup-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="w-popup-close" aria-label="Close" onClick={() => setOpen(null)}>
          ×
        </button>
        {p.content}
      </div>
    </div>
  );
}

/* ─── Forms (Elementor form fields → ITTI form engine) ────────────────── */
type ElField = { _id?: string; custom_id?: string; field_type?: string; field_label?: string; placeholder?: string; required?: string | boolean; width?: string; field_options?: string; rows?: string; acceptance_text?: string; field_html?: string; field_value?: string };

export const fieldName = (f: ElField, i: number) => {
  const key = String(f.custom_id || `field_${i}`).replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z]/.test(key) ? key : `f_${key}`;
};

export function FormClient({ fields, formSlug, apiUrl, button, showLabels, success, error, buttonWidth }: { fields: ElField[]; formSlug: string; apiUrl: string; button: string; showLabels: boolean; success: string; error: string; buttonWidth?: string }) {
  const [state, setState] = useState<{ pending: boolean; ok?: boolean; message?: string }>({ pending: false });
  const formRef = useRef<HTMLFormElement>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ pending: true });
    try {
      const res = await fetch(`${apiUrl}/v1/forms/${formSlug}/submissions`, { method: 'POST', body: new FormData(e.currentTarget) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.ok) {
        setState({ pending: false, ok: true, message: success });
        formRef.current?.reset();
      } else setState({ pending: false, ok: false, message: data.error ?? error });
    } catch {
      setState({ pending: false, ok: false, message: error });
    }
  }
  return (
    <form ref={formRef} className="w-form" onSubmit={onSubmit}>
      {fields.map((f, i) => {
        const name = fieldName(f, i);
        const type = f.field_type ?? 'text';
        const required = f.required === true || f.required === 'true';
        const width = { flexBasis: `calc(${f.width ?? 100}% - 10px)`, maxWidth: `${f.width ?? 100}%` };
        const label = showLabels && f.field_label && type !== 'acceptance' ? <label className="w-form-label" htmlFor={`f-${formSlug}-${name}`}>{f.field_label}{required ? ' *' : ''}</label> : null;
        const common = { id: `f-${formSlug}-${name}`, name, required, placeholder: f.placeholder, className: 'w-form-field', 'aria-label': f.field_label };
        if (type === 'step') return <div key={i} className="w-form-step">{f.field_label}</div>;
        if (type === 'html') return <div key={i} className="w-form-group" style={width} dangerouslySetInnerHTML={{ __html: f.field_html ?? '' }} />;
        if (type === 'hidden') return <input key={i} type="hidden" name={name} value={f.field_value ?? ''} />;
        const opts = String(f.field_options ?? '').split('\n').filter(Boolean).map((o) => { const [l, v] = o.split('|'); return { label: l!.trim(), value: (v ?? l!).trim() }; });
        let input: ReactNode;
        if (type === 'textarea') input = <textarea {...common} rows={Number(f.rows ?? 4)} />;
        else if (type === 'select') input = <select {...common} defaultValue=""><option value="" disabled>{f.placeholder || 'Select…'}</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
        else if (type === 'radio' || type === 'checkbox') input = <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{opts.map((o) => <label key={o.value} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type={type} name={name} value={o.value} required={type === 'radio' && required} /> {o.label}</label>)}</div>;
        else if (type === 'acceptance') input = <label style={{ display: 'inline-flex', gap: 8, alignItems: 'flex-start' }}><input type="checkbox" name={name} value="true" required={required} /> <span>{f.acceptance_text || f.field_label}</span></label>;
        else if (type === 'upload') input = <input {...common} type="file" />;
        else input = <input {...common} type={({ tel: 'tel', email: 'email', number: 'number', date: 'date', time: 'time', url: 'url' } as Record<string, string>)[type] ?? 'text'} />;
        return <div key={f._id ?? i} className="w-form-group" style={width}>{label}{input}</div>;
      })}
      <div className="w-form-group" style={{ flexBasis: `calc(${buttonWidth ?? 100}% - 10px)`, maxWidth: `${buttonWidth ?? 100}%`, justifyContent: 'flex-end' }}>
        <button type="submit" className="w-form-submit" disabled={state.pending}>{state.pending ? 'Sending…' : button}</button>
      </div>
      {state.message && <div className={`w-form-message ${state.ok ? 'w-form-success' : 'w-form-error'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</div>}
    </form>
  );
}

export type { LayoutNode };

/**
 * Swaps images that failed to load for their bundled fallback (`data-fallback`), e.g. the
 * logos when the media server is unreachable. Also fixes images that failed before hydration.
 */
export function ImageFallbacks() {
  useEffect(() => {
    const swap = (img: HTMLImageElement) => {
      const fb = img.dataset.fallback;
      if (!fb || img.dataset.fallbackUsed) return;
      img.dataset.fallbackUsed = '1';
      img.removeAttribute('srcset');
      img.src = fb;
    };
    document.querySelectorAll<HTMLImageElement>('img[data-fallback]').forEach((img) => {
      if (img.complete && img.naturalWidth === 0) swap(img);
    });
    const onError = (e: Event) => {
      if (e.target instanceof HTMLImageElement) swap(e.target);
    };
    window.addEventListener('error', onError, true);
    return () => window.removeEventListener('error', onError, true);
  }, []);
  return null;
}
