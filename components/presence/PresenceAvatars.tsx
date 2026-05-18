"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

interface Member {
  userId: string;
  name: string;
  initials: string;
}

interface Props {
  /** Stable channel key, e.g. "event:abc123" or "task:t5". */
  channelKey: string;
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#14B8A6", "#A78BFA", "#F472B6"];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function PresenceAvatars({ channelKey }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return;

    const channel = supabase.channel(`presence:${channelKey}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name: string; initials: string }>>;
        const flat: Member[] = [];
        for (const [userId, metas] of Object.entries(state)) {
          const meta = metas?.[0];
          if (meta) flat.push({ userId, name: meta.name, initials: meta.initials });
        }
        setMembers(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: user.name, initials: user.initials });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [channelKey, user]);

  if (members.length === 0) return null;

  // Always show self last; trim to 5 avatars.
  const others = members.filter((m) => m.userId !== user?.id).slice(0, 5);
  const overflow = Math.max(0, members.length - 1 - others.length);

  return (
    <div
      title={`${members.length} viewer${members.length === 1 ? "" : "s"}`}
      style={{
        position: "fixed", top: 14, right: 70, zIndex: 70,
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 10px 5px 6px",
        background: "rgba(13,15,24,0.85)",
        border: "1px solid rgba(99,102,241,0.22)",
        borderRadius: 100,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ display: "flex" }}>
        {others.map((m, i) => (
          <div
            key={m.userId}
            title={m.name}
            style={{
              width: 26, height: 26, borderRadius: "50%",
              background: colorFor(m.userId), color: "white",
              fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #0F1117",
              marginLeft: i === 0 ? 0 : -8,
              zIndex: 10 - i,
            }}
          >{m.initials}</div>
        ))}
        {overflow > 0 && (
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #0F1117", marginLeft: -8,
          }}>+{overflow}</div>
        )}
      </div>
      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
        {members.length === 1 ? "Just you" : `${members.length} viewing`}
      </span>
    </div>
  );
}
