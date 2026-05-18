"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone, X, Pin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  loadAnnouncements,
  loadAnnouncementReadIds,
  markAnnouncementRead,
  subscribeAnnouncements,
} from "@/lib/db";
import type { UnioAnnouncement } from "@/lib/store";
import { Markdown } from "./md";

export function AnnouncementBanner() {
  const { user } = useAuth();
  const [items, setItems] = useState<UnioAnnouncement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const [all, reads] = await Promise.all([loadAnnouncements(), loadAnnouncementReadIds()]);
    setItems(all);
    setReadIds(new Set(reads));
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh();
    const unsubscribe = subscribeAnnouncements(refresh);
    const onLocal = () => refresh();
    window.addEventListener("unio-store-change", onLocal);
    return () => {
      unsubscribe();
      window.removeEventListener("unio-store-change", onLocal);
    };
  }, [user, refresh]);

  const dismiss = useCallback(async (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
    await markAnnouncementRead(id).catch(console.warn);
  }, []);

  const unread = items.filter((a) => !readIds.has(a.id)).slice(0, 3);
  if (unread.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
      <AnimatePresence>
        {unread.map((a) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
            style={{
              position: "relative",
              padding: "14px 18px",
              borderRadius: 12,
              background: a.pinned
                ? "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.04))"
                : "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(99,102,241,0.04))",
              border: `1px solid ${a.pinned ? "rgba(245,158,11,0.3)" : "rgba(99,102,241,0.25)"}`,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: a.pinned ? "rgba(245,158,11,0.18)" : "rgba(99,102,241,0.18)",
                  color: a.pinned ? "#F59E0B" : "#818CF8",
                }}
              >
                {a.pinned ? <Pin size={16} /> : <Megaphone size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{a.title}</span>
                  {a.authorName && (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                      · {a.authorName}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  <Markdown>{a.bodyMd}</Markdown>
                </div>
              </div>
              <button
                onClick={() => dismiss(a.id)}
                title="Dismiss"
                style={{
                  width: 28, height: 28, flexShrink: 0,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
