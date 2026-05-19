"use client";

import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { loadTasks as dbLoadTasks, loadParticipants as dbLoadParticipants } from "@/lib/db";
import { type UnioTask, type UnioParticipant } from "@/lib/store";

export default function MyWorkPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<UnioTask[]>([]);
  const [participants, setParticipants] = useState<UnioParticipant[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchData = async () => {
      const [allTasks, allParticipants] = await Promise.all([
        dbLoadTasks(),
        dbLoadParticipants(),
      ]);
      if (cancelled) return;
      setTasks(allTasks.filter((t) => t.assignees.some((a) => a.i === user.initials)));
      setParticipants(allParticipants.filter((p) => p.status === "checked-in"));
    };
    fetchData();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="space-y-6 text-slate-100 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">My Work</h1>
        <p className="text-sm text-slate-400">Manage your assigned tasks and view recent check-ins.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl bg-black/40 border border-white/10 p-6 shadow-[0_20px_60px_rgba(15,17,23,0.9)]">
          <h2 className="text-base font-semibold text-white mb-4">Assigned Tasks</h2>
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">You have no tasks assigned to you right now.</p>
          ) : (
            <ul className="space-y-3">
              {tasks.map(t => (
                <li key={t.id} className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="font-semibold text-sm">{t.title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{t.event}</span>
                    <span className="text-[10px] text-slate-400">{t.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl bg-black/40 border border-white/10 p-6 shadow-[0_20px_60px_rgba(15,17,23,0.9)]">
          <h2 className="text-base font-semibold text-white mb-4">Recent Check-ins</h2>
          {participants.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No one has checked in yet.</p>
          ) : (
            <ul className="space-y-3">
              {participants.slice(0, 10).map(p => (
                <li key={p.id} className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div>
                    <p className="font-semibold text-sm text-emerald-100">{p.name}</p>
                    <p className="text-[11px] text-emerald-300/60 mt-0.5">{p.dept}</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">{p.checkedInAt || "Checked In"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
