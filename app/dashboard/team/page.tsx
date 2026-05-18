"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { loadTeamMembers, removeTeamMember, inviteTeamMember, type TeamMember } from "@/lib/db";
import { Plus, Mail, Trash2, Crown, User, CheckCircle2 } from "lucide-react";

export default function TeamPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    const members = await loadTeamMembers();
    setTeam(members);
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await inviteTeamMember(inviteEmail);
      setInviting(false);
      setInviteSuccess(true);
      if (res.token) {
        setInviteLink(`${window.location.origin}/auth/accept-invite?token=${res.token}`);
      }
    } catch (err: any) {
      console.error(err);
      setInviting(false);
      alert(`Failed to send invite: ${err.message || err}`);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setTeam(prev => prev.filter(m => m.id !== id));
    await removeTeamMember(id);
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
              style={{ background: "#1A1D2E", borderRadius: 24, padding: 32, width: "100%", maxWidth: 400, border: "1px solid rgba(255,255,255,0.05)", position: "relative" }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#fff" }}>Invite Club Mate</h2>
              <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>They will receive an email to join your club workspace.</p>
              
              <form onSubmit={handleInvite}>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Email Address</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: 16, top: 14, color: "rgba(255,255,255,0.4)" }} />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="mate@college.edu"
                      required
                      style={{ width: "100%", padding: "12px 16px 12px 42px", borderRadius: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => { setShowInvite(false); setInviteSuccess(false); setInviteLink(""); }}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.05)", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  {!inviteSuccess && (
                    <button
                      type="submit"
                      disabled={inviting}
                      style={{ flex: 1, padding: "12px", borderRadius: 12, background: "#6366F1", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      {inviting ? "Sending..." : "Send Invite"}
                    </button>
                  )}
                </div>
                
                {inviteSuccess && inviteLink && (
                  <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 13, color: "#10B981", fontWeight: 600 }}><CheckCircle2 size={14} className="inline mr-1" /> Invitation Created</p>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>For demo purposes, share this link with the user:</p>
                    <input type="text" readOnly value={inviteLink} onClick={e => e.currentTarget.select()} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, outline: "none" }} />
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
