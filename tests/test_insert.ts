import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false }, realtime: { transport: WebSocket as any } });

async function test() {
  const { data: authData } = await supabase.auth.signInWithPassword({ email: "ayaan@college.edu", password: "password123" });
  const userId = authData.user?.id;
  
  const event = {
    id: "test-event-123",
    organizer_id: userId,
    name: "Test Event",
    type: "Other",
    description: "test",
    date: "TBD",
    venue: "TBD",
    participants: 0,
    capacity: 100,
    completion: 0,
    status: "upcoming",
    tasks_done: 0,
    tasks_total: 0,
    days_remaining: 0,
    assignees: [],
    start_date: "2026-05-20",
    end_date: "2026-05-21",
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from("events").insert(event);
  console.log("Insert Error:", error);
}
test();
