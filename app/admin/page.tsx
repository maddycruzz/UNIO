"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { getPlatformStats } from "@/lib/db";
import Link from "next/link";
import { Shield, Users, Database, Activity, ArrowLeft } from "lucide-react";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<{ totalUsers: number; totalEvents: number; totalTasks: number } | null>(null);

  useEffect(() => {
    if (!loading && user?.role !== "developer") {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role !== "developer") return;
    let cancelled = false;
    getPlatformStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setStats({ totalUsers: 0, totalEvents: 0, totalTasks: 0 }); });
    return () => { cancelled = true; };
  }, [user]);

  if (loading || user?.role !== "developer") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1117]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1117] p-8 font-sans text-white md:p-12">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
                <ArrowLeft size={16} />
              </Link>
              <div className="flex items-center gap-2 rounded-md bg-rose-500/10 px-2 py-1 text-xs font-bold uppercase tracking-wider text-rose-500 ring-1 ring-rose-500/20">
                <Shield size={12} /> Super Admin
              </div>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Platform Admin</h1>
            <p className="mt-2 text-sm text-slate-400">Global overview and system management for UNIO.</p>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <div className="flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-xs font-bold shadow-[0_0_15px_rgba(244,63,94,0.4)]">
                {user.initials}
              </div>
              <div>
                <div className="text-xs font-semibold">{user.name}</div>
                <div className="text-[10px] text-slate-400">{user.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { label: "Total Users",  value: stats?.totalUsers,  icon: Users,    color: "text-indigo-400",  bg: "bg-indigo-400/10" },
            { label: "Total Events", value: stats?.totalEvents, icon: Database, color: "text-emerald-400", bg: "bg-emerald-400/10" },
            { label: "Total Tasks",  value: stats?.totalTasks,  icon: Activity, color: "text-amber-400",   bg: "bg-amber-400/10" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative overflow-hidden rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-400">{stat.label}</div>
                  <div className="mt-2 text-4xl font-bold tracking-tight">
                    {stat.value === undefined ? "—" : stat.value.toLocaleString()}
                  </div>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-xl" />
            </motion.div>
          ))}
        </div>

        {/* System Status & Logs */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 lg:col-span-2">
            <h2 className="mb-6 text-lg font-bold">System Status</h2>
            <div className="space-y-4">
              {[
                { service: "Database",      status: "Operational" },
                { service: "Auth Provider", status: "Operational" },
                { service: "Storage",       status: "Operational" },
              ].map((sys) => (
                <div key={sys.service} className="flex items-center justify-between rounded-xl bg-black/40 p-4 ring-1 ring-white/5">
                  <div className="font-medium">{sys.service}</div>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    {sys.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <h2 className="mb-6 text-lg font-bold">Recent Actions</h2>
            <div className="space-y-4">
              <div className="text-sm text-slate-400">
                Audit logs are restricted to global developers. Coming soon in Phase 3.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
