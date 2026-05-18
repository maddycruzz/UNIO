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
  
  console.log("Testing activity_log insert...");
  const start = Date.now();
  const { data, error } = await supabase.from("activity_log").insert({ organizer_id: userId, title: "Test", meta: "Test" });
  console.log("Result:", { error }, "Time:", Date.now() - start, "ms");
}
test();
