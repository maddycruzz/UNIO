import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false }, realtime: { transport: WebSocket as any } }
);

async function test() {
  const { data: authData } = await supabase.auth.signInWithPassword({ email: "ayaan@college.edu", password: "password123" });
  const userId = authData.user?.id;
  
  const newEventId = "test-event-select-" + Date.now();
  const event = {
    id: newEventId,
    organizer_id: userId,
    name: "Test Event Select",
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
    created_at: new Date().toISOString()
  };

  const { error } = await supabase.from("events").insert(event);
  console.log("Insert Error:", error);

  const { data, error: selectErr } = await supabase.from("events").select("*").eq("id", newEventId);
  console.log("Select Error:", selectErr);
  console.log("Found event:", data?.length === 1);
}
test();
