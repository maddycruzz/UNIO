import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false }, realtime: { transport: WebSocket as any } }
);

async function test() {
  await supabase.auth.signInWithPassword({ email: "ayaan@college.edu", password: "password123" });
  const { data, error } = await supabase.from("events").select("*");
  console.log("Events:", data?.length, "Error:", error);
}
test();
