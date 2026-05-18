import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false }, realtime: { transport: WebSocket as any } }
);

async function test() {
  console.log("Signing in...");
  const { data: authData } = await supabase.auth.signInWithPassword({ email: "ayaan@college.edu", password: "password123" });
  const userId = authData.user?.id;
  console.log("User ID:", userId);

  console.log("Fetching profile...");
  const start = Date.now();
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", userId).single();
  console.log("Profile:", profile, "Error:", error, "Time:", Date.now() - start, "ms");
}
test();
