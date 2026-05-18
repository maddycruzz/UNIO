"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X, Send, AtSign } from "lucide-react";
import {
  loadCommentsFor,
  addComment,
  subscribeComments,
  loadTeamMembers,
} from "@/lib/db";
import type {
  UnioComment,
  CommentParentType,
} from "@/lib/store";
import { formatRelativeTime } from "@/lib/store";
import { Markdown } from "@/components/announcements/md";
import { useAuth } from "@/lib/auth";

type TeamMember = { id: string; name: string; initials: string };

interface Props {
  parentType: CommentParentType;
  parentId: string;
  /** Floating-button mode (default) shows the bubble; pass false to render only when externally open. */
  showFab?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommentDrawer({
  parentType,
  parentId,
  showFab = true,
  open: openProp,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = useCallback(
    (v: boolean) => {
      if (onOpenChange) onOpenChange(v);
      else setOpenState(v);
    },
    [onOpenChange],
  );

  const [comments, setComments] = useState<UnioComment[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [body, setBody] = useState("");
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const refresh = useCallback(async () => {
    setComments(await loadCommentsFor(parentType, parentId));
  }, [parentType, parentId]);

  useEffect(() => {
    if (!open) return;
    refresh();
    loadTeamMembers().then((list) =>
      setTeam(list.map((m) => ({ id: m.id, name: m.name, initials: m.initials }))),
    );
    const unsub = subscribeComments(parentType, parentId, refresh);
    return () => unsub();
  }, [open, parentType, parentId, refresh]);

  const filteredTeam = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return team.slice(0, 6);
    return team.filter((m) => m.name.toLowerCase().includes(q) || m.initials.toLowerCase().includes(q)).slice(0, 6);
  }, [team, mentionQuery]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setBody(v);
    // Detect a pending @mention token at the cursor.
    const caret = e.target.selectionStart ?? v.length;
    const upTo = v.slice(0, caret);
    const m = upTo.match(/@(\w*)$/);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1] ?? "");
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (member: TeamMember) => {
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? body.length;
    const upTo = body.slice(0, caret);
    const m = upTo.match(/@(\w*)$/);
    if (!m) return;
    const start = caret - m[0].length;
    const before = body.slice(0, start);
    const after = body.slice(caret);
    const insertion = `@${member.name.replace(/\s+/g, "")} `;
    const next = `${before}${insertion}${after}`;
    setBody(next);
    setMentionedIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionOpen(false);
    setMentionQuery("");
    // Restore focus after state update.
    requestAnimationFrame(() => {
      el.focus();
      const newCaret = before.length + insertion.length;
      el.setSelectionRange(newCaret, newCaret);
    });
  };

  const onPost = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      // Only keep mentions whose @name is still present in the text.
      const stillMentioned = team
        .filter((m) => mentionedIds.includes(m.id) && body.includes(`@${m.name.replace(/\s+/g, "")}`))
        .map((m) => m.id);
      await addComment({ parentType, parentId, bodyMd: body.trim(), mentions: stillMentioned });
      setBody("");
      setMentionedIds([]);
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Failed to post comment: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showFab && (
        <button
          onClick={() => setOpen(true)}
          title="Comments"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 80,
            width: 50, height: 50, borderRadius: "50%",
            background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
            color: "white", border: "none", cursor: "pointer",
            boxShadow: "0 8px 28px rgba(99,102,241,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <MessageSquare size={20} />
          {comments.length > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2,
              minWidth: 20, height: 20, padding: "0 6px",
              borderRadius: 10, background: "#F472B6",
              color: "white", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #0F1117",
            }}>{comments.length}</span>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 90 }}
            />
            <motion.aside
              initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }} transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: "fixed", top: 0, right: 0, bottom: 0,
                width: "min(420px, 100vw)", zIndex: 100,
                background: "linear-gradient(180deg, #0D0F18, #0A0C14)",
                borderLeft: "1px solid rgba(99,102,241,0.18)",
                display: "flex", flexDirection: "column",
                color: "white", fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.18)", color: "#818CF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MessageSquare size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Comments</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{comments.length} {comments.length === 1 ? "comment" : "comments"}</div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={14} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                {comments.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                    No comments yet. Start the thread.
                  </div>
                ) : (
                  comments.map((c) => {
                    const mine = c.authorId === user?.id;
                    return (
                      <div key={c.id} style={{ marginBottom: 14, display: "flex", gap: 10 }}>
                        <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "50%", background: mine ? "linear-gradient(135deg, #6366F1, #10B981)" : "linear-gradient(135deg, #8B5CF6, #EC4899)", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {c.authorInitials || "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{c.authorName || "Someone"}</span>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{formatRelativeTime(new Date(c.createdAt).getTime())}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                            <Markdown>{c.bodyMd}</Markdown>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ position: "relative", padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {mentionOpen && filteredTeam.length > 0 && (
                  <div style={{
                    position: "absolute", left: 12, right: 12, bottom: "calc(100% + 6px)",
                    background: "#161826", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10,
                    padding: 6, boxShadow: "0 10px 40px rgba(0,0,0,0.6)", zIndex: 110,
                  }}>
                    <div style={{ padding: "4px 8px 6px", fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
                      <AtSign size={10} /> Mention
                    </div>
                    {filteredTeam.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => insertMention(m)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px",
                          background: "transparent", border: "none", color: "white", cursor: "pointer",
                          fontSize: 13, textAlign: "left", borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.12)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #6366F1, #10B981)", color: "white", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.initials}</span>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea
                    ref={inputRef}
                    value={body}
                    onChange={onChange}
                    rows={2}
                    placeholder="Write a comment… @mention to ping"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        onPost();
                      }
                      if (e.key === "Escape") setMentionOpen(false);
                    }}
                    style={{
                      flex: 1, resize: "none",
                      padding: "8px 10px", borderRadius: 8,
                      background: "rgba(0,0,0,0.3)", color: "white",
                      border: "1px solid rgba(255,255,255,0.08)", fontSize: 13, fontFamily: "inherit", outline: "none",
                    }}
                  />
                  <button
                    onClick={onPost}
                    disabled={!body.trim() || busy}
                    title="Post (⌘↵)"
                    style={{
                      width: 44, height: 44, borderRadius: 8,
                      background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                      color: "white", border: "none", cursor: !body.trim() || busy ? "not-allowed" : "pointer",
                      opacity: !body.trim() || busy ? 0.5 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
