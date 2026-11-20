import type { LayoutNode } from '@itti/schemas';
import type { ComponentType, ReactNode } from 'react';
import type { RenderContext } from './context';
import { asImage, resolveProps } from './dynamic';
import { CarouselClient, ContactButtonsClient, CountdownClient, CounterClient, FormClient, NavMenuClient, TabsClient } from './interactive';
import { mediaSrc } from './media';
import * as W from './widgets';

type WidgetComponent = ComponentType<W.WidgetProps>;

const render = (nodes: LayoutNode[] | undefined, ctx?: RenderContext): ReactNode => nodes?.map((n) => <Node key={n.id} node={n} ctx={ctx!} />);

/* Interactive widgets: server wrapper prepares props, client component renders. */
const NestedTabs: WidgetComponent = ({ node, p, ctx }) => (
  <TabsClient
    titles={(p.tabs ?? []).map((t: any) => String(t.tab_title ?? ''))}
    panels={(node.children ?? []).map((c) => render([c], ctx))}
    direction={p.tabs_direction}
  />
);

const ImageCarousel: WidgetComponent = ({ p, ctx }) => (
  <CarouselClient
    perView={Number(p.slides_to_show ?? 3)}
    arrows={!['dots', 'none'].includes(p.navigation)}
    dots={!['arrows', 'none'].includes(p.navigation)}
    autoplay={p.autoplay !== 'no'}
    interval={Number(p.autoplay_speed ?? 5000)}
    slides={(p.carousel ?? []).map((img: any, i: number) => <W.Img key={i} src={img} ctx={ctx} />)}
  />
);

const TestimonialCarousel: WidgetComponent = ({ p, ctx }) => (
  <CarouselClient
    perView={Number(p.slides_per_view ?? 1)}
    autoplay={p.autoplay !== 'no'}
    slides={(p.slides ?? []).map((s: any, i: number) => (
      <div key={i} className={`w-tc-slide w-tc-skin-${p.skin || 'default'}`}>
        <div className="w-tc-content" dangerouslySetInnerHTML={{ __html: String(s.content ?? '') }} />
        <div className="w-tc-footer" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {asImage(s.image) && <W.Img src={s.image} ctx={ctx} className="w-tc-image" />}
          <div>
            <div className="w-tc-name">{s.name}</div>
            <div className="w-tc-title">{s.title}</div>
          </div>
        </div>
      </div>
    ))}
  />
);

const Counter: WidgetComponent = ({ p }) => (
  <CounterClient
    start={Number(p.starting_number ?? 0)}
    end={Number(p.ending_number ?? 100)}
    prefix={p.prefix ?? ''}
    suffix={p.suffix ?? ''}
    duration={Number(p.duration ?? 2000)}
    separator={p.thousand_separator === '' ? '' : ({ '.': '.', ' ': ' ', default: ',' } as Record<string, string>)[p.thousand_separator_char ?? 'default'] ?? ','}
    title={p.title}
  />
);

const Countdown: WidgetComponent = ({ p }) => (
  <CountdownClient
    due={p.due_date}
    showSeconds={p.show_seconds !== ''}
    labels={[p.label_days ?? 'Days', p.label_hours ?? 'Hours', p.label_minutes ?? 'Minutes', p.label_seconds ?? 'Seconds']}
  />
);

const NavMenu: WidgetComponent = ({ p, ctx }) => <NavMenuClient items={ctx.menus[p.menu]?.items ?? Object.values(ctx.menus)[0]?.items ?? []} path={ctx.path} toggle={p.dropdown} />;

const ContactButtons: WidgetComponent = ({ p, ctx }) => (
  <ContactButtonsClient
    name={p.top_bar_title}
    subtitle={p.top_bar_subtitle}
    avatar={mediaSrc(asImage(p.top_bar_image)?.url, ctx)}
    message={p.message_bubble_body}
    cta={p.send_button_text}
    phone={String(p.chat_button_number ?? '')}
  />
);

const Form: WidgetComponent = ({ p, ctx }) => (
  <FormClient
    fields={p.form_fields ?? []}
    formSlug={p.formSlug}
    apiUrl={ctx.apiUrl}
    button={p.button_text ?? 'Send'}
    showLabels={p.show_labels !== ''}
    success={p.success_message ?? 'The form was sent successfully.'}
    error={p.error_message ?? 'An error occurred.'}
    buttonWidth={p.button_width}
  />
);

/** Widget type → component. Add an entry here to support a new widget. */
export const WIDGETS: Record<string, WidgetComponent> = {
  heading: W.Heading,
  'text-editor': W.TextEditor,
  button: W.Button,
  icon: W.IconWidget,
  image: W.Image,
  'icon-list': W.IconList,
  spacer: W.Spacer,
  divider: W.Divider,
  html: W.Html,
  shortcode: W.Html,
  google_maps: W.GoogleMaps,
  blockquote: W.Blockquote,
  'icon-box': W.IconBox,
  'image-box': W.ImageBox,
  'call-to-action': W.CallToAction,
  'social-icons': W.SocialIcons,
  'share-buttons': W.ShareButtons,
  'post-info': W.PostInfo,
  'theme-post-title': W.Heading,
  'theme-archive-title': W.Heading,
  'theme-post-featured-image': W.FeaturedImage,
  'theme-post-content': W.PostContent,
  'author-box': W.AuthorBox,
  'post-navigation': W.PostNavigation,
  zigzag: W.Zigzag,
  gallery: W.Gallery,
  'nested-accordion': W.NestedAccordion,
  toggle: W.Toggle,
  accordion: W.Toggle,
  posts: W.Posts,
  'tpg-grid-layout': W.PostGrid,
  'loop-grid': W.LoopGrid,
  template: W.TemplateEmbed,
  'nested-tabs': NestedTabs,
  'image-carousel': ImageCarousel,
  'testimonial-carousel': TestimonialCarousel,
  counter: Counter,
  countdown: Countdown,
  'nav-menu': NavMenu,
  'contact-buttons': ContactButtons,
  form: Form,
};

const hideCls = (n: LayoutNode) => (n.hide ?? []).map((h) => `hide-${h}`).join(' ');

const isBlank = (v: unknown) => v == null || (typeof v === 'string' && v.replace(/<[^>]*>|&nbsp;|\s/g, '') === '') || (Array.isArray(v) && v.length === 0);

function Node({ node, ctx }: { node: LayoutNode; ctx: RenderContext }) {
  if (node.showIf && isBlank(ctx.record?.fields?.[node.showIf])) return null;
  const extra = [node.className, hideCls(node)].filter(Boolean).join(' ');
  if (node.type === 'container') {
    const p = resolveProps(node.props ?? {}, ctx) as Record<string, any>;
    const boxed = Boolean(p.boxed);
    const cls = `e-con ${boxed ? 'e-con-boxed' : 'e-con-full'} n-${node.id}${p.overlay ? ' has-overlay' : ''}${extra ? ' ' + extra : ''}`;
    const kids = render(node.children, ctx);
    const inner = boxed ? <div className="e-con-inner">{kids}</div> : kids;
    if (p.link?.url) {
      return (
        <a href={String(p.link.url)} className={cls}>
          {inner}
        </a>
      );
    }
    const Tag = (['section', 'header', 'footer', 'article', 'aside', 'nav', 'main'].includes(p.tag) ? p.tag : 'div') as 'div';
    return <Tag className={cls}>{inner}</Tag>;
  }
  const Comp = WIDGETS[node.type];
  if (!Comp) return null;
  const p = resolveProps(node.props ?? {}, ctx) as Record<string, any>;
  return (
    <div className={`w w-${node.type} n-${node.id}${extra ? ' ' + extra : ''}`}>
      <Comp node={node} p={p} ctx={ctx} render={render} />
    </div>
  );
}

/** Render a layout tree (page, template, course layout…). */
export function Layout({ nodes, ctx }: { nodes: LayoutNode[] | undefined; ctx: RenderContext }) {
  return <>{render(nodes, ctx)}</>;
}
