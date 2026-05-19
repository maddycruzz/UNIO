"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Plus, Pin, Trash2, Clock } from "lucide-react";
import {
  loadAnnouncements,
  addAnnouncement,
  deleteAnnouncement,
  subscribeAnnouncements,
} from "@/lib/db";
import type { UnioAnnouncement } from "@/lib/store";
import { formatRelativeTime } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PermissionGate, useCan } from "@/lib/permissions";
import { Markdown } from "@/components/announcements/md";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const canCreate = useCan("announcements.create");
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<UnioAnnouncement[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await loadAnnouncements());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeAnnouncements(refresh);
    const onLocal = () => refresh();
    window.addEventListener("unio-store-change", onLocal);
    return () => {
      unsub();
      window.removeEventListener("unio-store-change", onLocal);
    };
  }, [refresh]);

  const onPost = async () => {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    try {
      await addAnnouncement({ title: title.trim(), bodyMd: body.trim(), pinned });
      setTitle("");
      setBody("");
      setPinned(false);
      setComposerOpen(false);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to post: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete announcement?",
      message: "This will remove the post for everyone. You can't undo this.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteAnnouncement(id);
      await refresh();
      toast.success("Announcement deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", color: "white", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(99,102,241,0.18)", color: "#818CF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Megaphone size={16} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Announcements</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            Broadcast updates to the whole club. Mates see new posts as banners on their dashboard.
          </p>
        </div>
        <PermissionGate action="announcements.create">
          <button
            onClick={() => setComposerOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 9,
              background: "linear-gradient(135deg, #6366F1, #818CF8)",
              border: "none", color: "white", fontWeight: 600, fontSize: 13,
              cursor: "pointer", boxShadow: "0 0 16px rgba(99,102,241,0.35)",
            }}
          >
            <Plus size={14} /> New announcement
          </button>
        </PermissionGate>
      </div>

      {composerOpen && canCreate && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 24,
            padding: 20, borderRadius: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            style={{
              width: "100%", boxSizing: "border-box", marginBottom: 10,
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(0,0,0,0.25)", color: "white",
              border: "1px solid rgba(255,255,255,0.08)", fontSize: 14, fontWeight: 600,
              outline: "none",
            }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Body — supports **bold**, *italic*, `code`, [links](https://...)"
            rows={5}
            style={{
              width: "100%", boxSizing: "border-box", marginBottom: 10,
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(0,0,0,0.25)", color: "white",
              border: "1px solid rgba(255,255,255,0.08)", fontSize: 13.5,
              outline: "none", fontFamily: "inherit", resize: "vertical",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.65)", cursor: "pointer" }}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <Pin size={13} /> Pin to top
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setComposerOpen(false); setTitle(""); setBody(""); setPinned(false); }}
                style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer" }}
              >Cancel</button>
              <button
                onClick={onPost}
                disabled={busy || !title.trim() || !body.trim()}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  background: "linear-gradient(135deg, #6366F1, #818CF8)",
                  border: "none", color: "white", fontWeight: 600, fontSize: 13,
                  cursor: busy ? "wait" : "pointer", opacity: busy || !title.trim() || !body.trim() ? 0.5 : 1,
                }}
              >{busy ? "Posting…" : "Post"}</button>
            </div>
          </div>
        </motion.div>
      )}

      {items.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14, color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          <Megaphone size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <div>No announcements yet.</div>
          {canCreate && <div style={{ fontSize: 12, marginTop: 6 }}>Use the “New announcement” button to broadcast your first one.</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((a) => (
            <div
              key={a.id}
              style={{
                position: "relative",
                padding: 18, borderRadius: 12,
                background: a.pinned
                  ? "linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.02))"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${a.pinned ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {a.pinned && <Pin size={12} style={{ color: "#F59E0B" }} />}
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{a.title}</span>
                </div>
                {(a.authorId === user?.id) && (
                  <button onClick={() => onDelete(a.id)} title="Delete" style={{ width: 28, height: 28, background: "transparent", border: "1px solid transparent", borderRadius: 7, color: "rgba(255,255,255,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)" }}>
                <Markdown>{a.bodyMd}</Markdown>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                <Clock size={11} />
                <span>{formatRelativeTime(new Date(a.createdAt).getTime())}</span>
                {a.authorName && <span>· {a.authorName}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
