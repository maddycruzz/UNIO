"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Upload, Trash2, ExternalLink, Loader2, File as FileIcon, Image as ImageIcon } from "lucide-react";
import { loadEventFiles, uploadEventFile, deleteEventFile } from "@/lib/db";
import type { UnioEventFile } from "@/lib/store";
import { useCan } from "@/lib/permissions";

interface Props { eventId: string }

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string) {
  return mime.startsWith("image/");
}

export function FilesPanel({ eventId }: Props) {
  const canUpload = useCan("files.upload");
  const canDelete = useCan("files.delete");
  const [files, setFiles] = useState<UnioEventFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => setFiles(await loadEventFiles(eventId)), [eventId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("unio-store-change", h);
    return () => window.removeEventListener("unio-store-change", h);
  }, [refresh]);

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`Max file size is ${formatBytes(MAX_BYTES)}.`);
      return;
    }
    setBusy(true);
    const res = await uploadEventFile({ eventId, file, kind: "attachment" });
    setBusy(false);
    e.target.value = "";
    if ("ok" in res && res.ok === false) {
      setError(res.error);
      return;
    }
    await refresh();
  };

  const onDelete = async (f: UnioEventFile) => {
    if (!confirm(`Delete ${f.name}?`)) return;
    await deleteEventFile(f);
    await refresh();
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-navy/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Paperclip className="h-4 w-4 text-indigo-300" /> Files
        </h3>
        {canUpload && (
          <>
            <input ref={inputRef} type="file" hidden onChange={onChange} />
            <button
              type="button"
              onClick={onPick}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/15 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-300">{error}</p>
      )}

      {files.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] text-slate-500">
          No files yet. {canUpload ? "Drop posters, sponsor decks, agendas, etc." : ""}
        </p>
      ) : (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-[11px]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-white/5 text-slate-300">
                {isImage(f.mime) ? <ImageIcon className="h-3.5 w-3.5" /> : <FileIcon className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-slate-100">{f.name}</div>
                <div className="text-[10px] text-slate-500">{formatBytes(f.sizeBytes)} · {f.mime.split("/")[1] ?? "file"}</div>
              </div>
              {f.publicUrl && (
                <a
                  href={f.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full p-1 text-slate-300 hover:bg-white/10"
                  title="Open"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(f)}
                  className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
