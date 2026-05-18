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
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  console.log("Profile role:", profile?.role);

  const { data: roleTest, error: rpcError } = await supabase.rpc("user_role");
  console.log("user_role() output:", roleTest, rpcError);
}
test();
