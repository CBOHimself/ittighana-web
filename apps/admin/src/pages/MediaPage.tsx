import type { Paginated } from '@itti/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { API_URL } from '@/lib/env';
import { http } from '@/lib/api';
import { Alert, Button, PageTitle, Spinner } from '@/ui';

type Media = { _id: string; url: string; alt: string; originalName: string; mime: string; width?: number; height?: number };

/** Media library. Uploads go to the cPanel media folder through the API. */
export function MediaPage() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({ queryKey: ['media'], queryFn: () => http<Paginated<Media>>('/admin/media?limit=100') });

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('file', f);
      const res = await fetch(`${API_URL}/v1/admin/media`, { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Upload failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });

  return (
    <>
      <PageTitle title="Media library" actions={<Button onClick={() => input.current?.click()} loading={upload.isPending}>Upload</Button>} />
      <input ref={input} type="file" multiple hidden accept="image/*,application/pdf,video/mp4" onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)} />
      {upload.error && <div className="mb-4"><Alert>{(upload.error as Error).message}</Alert></div>}
      {isLoading ? <Spinner /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {data?.items.map((m) => (
            <a key={m._id} href={m.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-gray-200 bg-white">
              {m.mime.startsWith('image/') ? (
                <img src={m.url} alt={m.alt} loading="lazy" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-gray-50 text-xs text-gray-500">{m.mime}</div>
              )}
              <div className="truncate px-2 py-1.5 text-xs text-gray-600">{m.originalName}</div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
