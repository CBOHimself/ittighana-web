/**
 * ─────────────────────────────────────────────────────────────────────────
 *  UI facade over @vantara-ui/ui
 * ─────────────────────────────────────────────────────────────────────────
 *  Admin screens import UI only from "@/ui". This file:
 *   1. re-exports vantara-ui components as-is (PageShell, DataTable, Modal…)
 *   2. adapts a few vantara components to the small API the screens use
 *      (Button with `loading`, Badge from a status string, Select with options…)
 *   3. fills gaps vantara-ui doesn't cover yet (Card, Spinner, error Alert).
 *  Theme tokens live in src/styles/vantara-theme.css.
 * ─────────────────────────────────────────────────────────────────────────
 */
import {
  Badge as VBadge,
  EmptyState as VEmptyState,
  Button as VButton,
  Callout,
  Input as VInput,
  Select as VSelect,
  type InputProps as VInputProps,
} from '@vantara-ui/ui';
import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/* 1 ─ Straight re-exports ─────────────────────────────────────────────── */
export {
  Calendar,
  Callout,
  Checkbox,
  CollapsibleSection,
  DataExportButton,
  DataTable,
  FileUploader,
  FormGrid,
  FormSectionHeader,
  IconCircle,
  MetricTile,
  Modal,
  OverflowMenu,
  PageShell,
  PageTitleBlock,
  QuickInfoCard,
  RadioGroup,
  StatsCard,
  SummaryCard,
  Tabs,
  exportRowsToCsv,
  exportRowsToXlsx,
  // 0.10
  Breadcrumbs,
  SegmentedControl,
  SidePanel,
  Tooltip,
  toast,
} from '@vantara-ui/ui';
export type {
  CalendarEvent,
  ColumnDefinition,
  DataTableRow,
  NavigationItem,
  OverflowMenuItem,
  RowAction,
  TabDefinition,
} from '@vantara-ui/ui';

/* 2 ─ Adapters ────────────────────────────────────────────────────────── */
/** EmptyState with centred, dark text (no grey on light backgrounds). */
export function EmptyState(props: Parameters<typeof VEmptyState>[0]) {
  return <VEmptyState {...props} className={['itti-empty', props.className].filter(Boolean).join(' ')} />;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const localVariants: Record<'ghost' | 'danger', string> = {
  ghost: 'text-gray-700 hover:bg-gray-100',
  danger: 'bg-error-600 text-white hover:bg-error-700',
};
const BUTTON_COLORS = {
  primary: { backgroundColor: '#002147', color: '#ffffff' },
  secondary: { backgroundColor: '#ffffff', color: '#002147', border: '1px solid #e6e6e6' },
} as const;
const spinner = <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;

/** vantara Button + `loading`, plus ghost/danger variants vantara doesn't have yet. */
export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  type = 'button',
  disabled,
  ...p
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & { variant?: Variant; loading?: boolean; type?: 'button' | 'submit' | 'reset' }) {
  if (variant === 'primary' || variant === 'secondary') {
    const { 'aria-pressed': pressed, ...rest } = p;
    return (
      <VButton
        {...rest}
        aria-pressed={pressed === true || pressed === 'true'}
        type={type}
        variant={variant}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 ${className}`}
        // vantara sets button colours inline (#030213); swap in the ITTI palette
        style={{ ...BUTTON_COLORS[variant], ...(disabled || loading ? { opacity: 0.6 } : {}), ...rest.style }}
      >
        {loading && spinner}
        {children}
      </VButton>
    );
  }
  return (
    <button {...p} type={type} disabled={disabled || loading} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${localVariants[variant]} ${className}`}>
      {loading && spinner}
      {children}
    </button>
  );
}

/**
 * Status colours shared by Badge and DataTable status cells.
 * vantara Badge takes Tailwind class names (not hex), so these must stay
 * literal strings for Tailwind to generate them.
 */
type Tone = { bg: string; text: string; border: string; dot: string };
const TONES = {
  green: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200', dot: 'bg-success-500' },
  amber: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200', dot: 'bg-warning-500' },
  blue: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-200', dot: 'bg-primary-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  red: { bg: 'bg-error-50', text: 'text-error-700', border: 'border-error-200', dot: 'bg-error-500' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400' },
} satisfies Record<string, Tone>;

export const STATUS_COLORS: Record<string, Tone> = {
  published: TONES.green,
  approved: TONES.green,
  accepted: TONES.green,
  draft: TONES.gray,
  review: TONES.amber,
  pending: TONES.amber,
  new: TONES.blue,
  reviewing: TONES.indigo,
  shortlisted: TONES.violet,
  declined: TONES.red,
  rejected: TONES.red,
  cancelled: TONES.gray,
  archived: TONES.gray,
  closed: TONES.gray,
  withdrawn: TONES.gray,
};

const label = (v: string) => (v.charAt(0).toUpperCase() + v.slice(1)).replace('_', ' ');

/** Status pill from a status string, e.g. <Badge>published</Badge>. */
export function Badge({ children }: { children: string }) {
  const c = STATUS_COLORS[children] ?? TONES.gray;
  return <VBadge label={label(children)} bgColor={c.bg} textColor={c.text} borderColor={c.border} dotColor={c.dot} showDot />;
}

/** Spread into a DataTable row so a `status` column renders with ITTI colours. */
export function statusCell(key: string, value: string | undefined) {
  const v = value ?? 'draft';
  const c = STATUS_COLORS[v] ?? TONES.gray;
  return {
    [key]: v,
    [`${key}Label`]: label(v),
    [`${key}Bg`]: c.bg,
    [`${key}Text`]: c.text,
    [`${key}Border`]: c.border,
    [`${key}ShowDot`]: false,
  };
}

export function Input({ type, ...p }: Omit<VInputProps, 'type'> & { type?: string }) {
  return <VInput {...p} type={type as VInputProps['type']} />;
}

export function Select({
  options,
  ...p
}: { options: Array<{ label: string; value: string }>; value?: string; onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void; label?: string; className?: string; name?: string; required?: boolean }) {
  return <VSelect {...p} options={options} />;
}

/* 3 ─ Gaps (not in vantara-ui 0.8 yet) ────────────────────────────────── */
const inputCls =
  'w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-border-focus focus:ring-2 focus:ring-primary-500/20';
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={4} {...p} className={`${inputCls} ${p.className ?? ''}`} />;

export const FormField = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-text-primary">{label}</span>
    {children}
    {hint && !error && <span className="mt-1 block text-xs text-text-secondary">{hint}</span>}
    {error && <span className="mt-1 block text-xs text-error-600">{error}</span>}
  </label>
);

export const Card = ({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) => (
  <div className={`rounded-card border border-border bg-white shadow-card ${className}`}>
    {(title || actions) && (
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="font-semibold text-text-primary">{title}</h2>
        {actions}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

/** Simple table for small, non-paginated lists (DataTable is preferred for big lists). */
export type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string };
export function Table<T extends { _id: string }>({ columns, rows, onRowClick, empty = 'Nothing here yet.' }: { columns: Column<T>[]; rows: T[]; onRowClick?: (row: T) => void; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>{columns.map((c) => <th key={c.key} className={`px-4 py-3 text-left font-semibold text-text-secondary ${c.className ?? ''}`}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-text-primary">{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={r._id} onClick={() => onRowClick?.(r)} className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}>
              {columns.map((c) => <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const PageTitle = ({ title, actions, subtitle }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
);

/** vantara Callout for info/success; vantara has no error variant yet, so errors render locally. */
export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  if (kind !== 'error') return <Callout variant={kind}>{children}</Callout>;
  return <div role="alert" className="rounded-md border border-error-200 bg-error-50 p-3 text-sm text-error-700">{children}</div>;
}

export const Stat = ({ label, value, href }: { label: string; value: ReactNode; href?: string }) => {
  const inner = (
    <div className="rounded-card border border-border bg-white p-5 shadow-card">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-text-primary">{value}</div>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
};

export const Spinner = () => (
  <div className="flex justify-center p-10">
    <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
  </div>
);
