/** "Built by HostHaus" watermark. Toggled in Settings (super admin only). */
export function HosthausMark({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400 transition hover:text-white"
      data-watermark="hosthaus"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3 2 11h3v10h6v-6h2v6h6V11h3L12 3Z" />
      </svg>
      {label}
    </a>
  );
}
