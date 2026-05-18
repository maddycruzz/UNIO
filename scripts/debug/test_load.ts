import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false }, realtime: { transport: WebSocket as any } });

async function test() {
  await supabase.auth.signInWithPassword({ email: "ayaan@college.edu", password: "password123" });
  const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false });
  console.log("Error:", error);
  console.log("Raw data length:", data?.length);
  if (data) {
    try {
      const events = data.map(row => {
        return {
          id:            row.id as string,
          name:          row.name as string,
          type:          row.type,
          description:   row.description as string,
          date:          row.date as string,
          venue:         row.venue as string,
          participants:  (row.participants as number) ?? 0,
          capacity:      row.capacity as number | null,
          completion:    (row.completion as number) ?? 0,
          status:        row.status,
          tasksDone:     (row.tasks_done as number) ?? 0,
          tasksTotal:    (row.tasks_total as number) ?? 0,
          daysRemaining: (row.days_remaining as number) ?? 0,
          assignees:     (row.assignees as string[]) ?? [],
          startDate:     row.start_date as string | undefined,
          endDate:       row.end_date as string | undefined,
          coverImage:    row.cover_image as string | undefined,
          createdAt:     row.created_at as string,
        };
      });
      console.log("Mapped events:", events.length);
    } catch (e: any) {
      console.log("Map error:", e.message);
    }
  }
}
test();
