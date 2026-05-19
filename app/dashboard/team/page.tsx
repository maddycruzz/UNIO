"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { loadTeamMembers, removeTeamMember, inviteTeamMember, type TeamMember } from "@/lib/db";
import { Plus, Mail, Trash2, Crown, User, CheckCircle2, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export default function TeamPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"mate" | "president">("mate");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteEmailDelivered, setInviteEmailDelivered] = useState<boolean | null>(null);
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    const members = await loadTeamMembers();
    setTeam(members);
    setLoading(false);
  };

  const resetInviteForm = () => {
    setShowInvite(false);
    setInviteSuccess(false);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("mate");
    setInviteMessage("");
    setInviteLink("");
    setInviteEmailDelivered(null);
    setInviteEmailError(null);
    setCopiedLink(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address.");
      return;
    }
    setInviting(true);
    try {
      const res = await inviteTeamMember({
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: inviteRole,
        message: inviteMessage.trim() || undefined,
        inviterName: user?.name,
      });
      setInviting(false);
      setInviteSuccess(true);
      setInviteEmailDelivered(res.emailDelivered ?? false);
      setInviteEmailError(res.emailError ?? null);
      if (res.token) {
        setInviteLink(`${window.location.origin}/auth/accept-invite?token=${res.token}`);
      }
      if (res.emailDelivered) {
        toast.success(`Invitation emailed to ${inviteEmail.trim()}.`);
      } else if (res.emailError) {
        toast.info("Invite created — email delivery failed. Share the link manually.");
      } else {
        toast.info("Invite created — email isn't configured. Share the link manually.");
      }
      // Refresh the team list so a re-invite of an existing member updates state.
      fetchTeam();
    } catch (err: any) {
      console.warn("invite failed:", err);
      setInviting(false);
      toast.error(`Failed to send invite: ${err?.message || err}`);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedLink(true);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy manually.");
    }
  };

  const handleRemove = async (id: string) => {
    const member = team.find((m) => m.id === id);
    const ok = await confirm({
      title: "Remove team member?",
      message: member?.name
        ? `${member.name} will lose access to this club's data. They can be re-invited later.`
        : "They will lose access to this club's data. They can be re-invited later.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    const prev = team;
    setTeam((p) => p.filter((m) => m.id !== id));
    try {
      await removeTeamMember(id);
      toast.success("Member removed.");
    } catch (e) {
      setTeam(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't remove member.");
    }
  };

  if (user?.role !== "president" && user?.role !== "developer") {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="text-gray-400 mt-2">Only Club Presidents can manage the team.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1200, margin: "0 auto", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>Team Management</h1>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.5)", fontSize: 15 }}>Invite club mates to help manage your events and tasks.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12,
            background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff", fontWeight: 600,
            fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.3)"
          }}
        >
          <Plus size={16} /> Invite Member
        </button>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>Loading team...</div>
        ) : team.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>No team members found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {team.map((member, i) => (
              <div key={member.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px",
                borderBottom: i < team.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: member.role === "president" ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "center", color: member.role === "president" ? "#818CF8" : "#fff", fontWeight: 700, fontSize: 16
                  }}>
                    {member.initials}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#fff" }}>{member.name}</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{member.email}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20,
                    background: member.role === "president" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                    color: member.role === "president" ? "#F59E0B" : "#10B981", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px"
                  }}>
                    {member.role === "president" ? <Crown size={12} /> : <User size={12} />}
                    {member.role === "president" ? "President" : "Club Mate"}
                  </div>
                  {member.role !== "president" && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 8, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#EF4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showInvite && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ background: "#1A1D2E", borderRadius: 24, padding: 28, width: "100%", maxWidth: 460, border: "1px solid rgba(255,255,255,0.05)", position: "relative", maxHeight: "90vh", overflowY: "auto" }}
            >
              {inviteSuccess ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={16} color="#34D399" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#fff" }}>Invitation ready</h2>
                  </div>
                  <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.55)", fontSize: 13.5, lineHeight: 1.5 }}>
                    {inviteEmailDelivered
                      ? <>An email has been sent to <strong style={{ color: "#fff" }}>{inviteEmail}</strong>. They&apos;ll be a {inviteRole === "president" ? "co-president" : "Club Mate"} once they accept.</>
                      : inviteEmailError
                        ? <>The invite is saved, but the email couldn&apos;t be delivered to <strong style={{ color: "#fff" }}>{inviteEmail}</strong>. Share the link below manually — it&apos;s valid for 7 days.</>
                        : <>Email delivery isn&apos;t set up here, but the invite is saved. Share the link below with <strong style={{ color: "#fff" }}>{inviteEmail}</strong> — it&apos;s valid for 7 days.</>
                    }
                  </p>
                  {inviteEmailError && (
                    <div style={{ margin: "0 0 16px", padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 11.5, fontFamily: "monospace", lineHeight: 1.5, wordBreak: "break-word" }}>
                      <strong style={{ color: "#fecaca", fontFamily: "inherit" }}>Send error:</strong> {inviteEmailError}
                    </div>
                  )}

                  <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Invitation link
                  </label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    <input
                      type="text"
                      readOnly
                      value={inviteLink}
                      onClick={e => e.currentTarget.select()}
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 9, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, outline: "none", fontFamily: "monospace", minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      style={{ padding: "10px 14px", borderRadius: 9, background: copiedLink ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)", border: `1px solid ${copiedLink ? "rgba(16,185,129,0.35)" : "rgba(99,102,241,0.35)"}`, color: copiedLink ? "#34D399" : "#A5B4FC", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      {copiedLink ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={resetInviteForm}
                      style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteSuccess(false);
                        setInviteEmail("");
                        setInviteName("");
                        setInviteMessage("");
                        setInviteEmailDelivered(null);
                        setInviteLink("");
                        setCopiedLink(false);
                      }}
                      style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#6366F1", border: "none", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                      Invite another
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 700, color: "#fff" }}>Invite a team member</h2>
                  <p style={{ margin: "0 0 22px", color: "rgba(255,255,255,0.55)", fontSize: 13.5 }}>
                    They&apos;ll get an email with a link to set up their account.
                  </p>

                  <form onSubmit={handleInvite}>
                    <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Email <span style={{ color: "#F87171" }}>*</span>
                    </label>
                    <div style={{ position: "relative", marginBottom: 16 }}>
                      <Mail size={14} style={{ position: "absolute", left: 14, top: 13, color: "rgba(255,255,255,0.35)" }} />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="mate@college.edu"
                        required
                        autoFocus
                        style={{ width: "100%", padding: "11px 14px 11px 38px", borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      />
                    </div>

                    <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Name <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.3)" }}>(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      placeholder="e.g. Ayaan Nizam"
                      autoComplete="off"
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16, fontFamily: "inherit" }}
                    />

                    <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Role
                    </label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      {(["mate", "president"] as const).map((r) => {
                        const active = inviteRole === r;
                        const Icon = r === "president" ? Crown : User;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setInviteRole(r)}
                            style={{
                              flex: 1, padding: "11px", borderRadius: 10,
                              background: active ? (r === "president" ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.12)") : "rgba(0,0,0,0.25)",
                              border: `1px solid ${active ? (r === "president" ? "rgba(245,158,11,0.4)" : "rgba(99,102,241,0.4)") : "rgba(255,255,255,0.1)"}`,
                              color: active ? (r === "president" ? "#FBBF24" : "#A5B4FC") : "rgba(255,255,255,0.55)",
                              fontWeight: 600, fontSize: 13, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                              fontFamily: "inherit",
                            }}
                          >
                            <Icon size={13} />
                            {r === "president" ? "Co-president" : "Club Mate"}
                          </button>
                        );
                      })}
                    </div>

                    <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Personal note <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.3)" }}>(optional)</span>
                    </label>
                    <textarea
                      value={inviteMessage}
                      onChange={e => setInviteMessage(e.target.value)}
                      placeholder="Something to say in the invite email…"
                      rows={3}
                      maxLength={500}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13.5, outline: "none", boxSizing: "border-box", marginBottom: 6, fontFamily: "inherit", resize: "vertical", minHeight: 60 }}
                    />
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 22, textAlign: "right" }}>
                      {inviteMessage.length}/500
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={resetInviteForm}
                        style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={inviting}
                        style={{ flex: 1, padding: "11px", borderRadius: 10, background: inviting ? "rgba(99,102,241,0.5)" : "#6366F1", border: "none", color: "#fff", fontWeight: 600, fontSize: 13, cursor: inviting ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
                      >
                        {inviting ? "Sending invite…" : "Send invitation"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
