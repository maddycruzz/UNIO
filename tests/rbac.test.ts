import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// Make sure you have dotenv or similar to load these in a real run
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket as any }
});

async function runTests() {
  console.log("Running RBAC Smoke Tests...");

  // Assume demo accounts exist with password123
  const demoAccounts = {
    president: "ayaan@college.edu",
    mate: "priya@college.edu",
    developer: "admin@unio.campus",
  };

  // 1. Test Mate Cannot Insert Event
  console.log("\n[Test 1] Mate cannot insert event");
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: demoAccounts.mate,
    password: "password123",
  });
  
  if (loginError) {
    console.error("Failed to login as Mate:", loginError.message);
  } else {
    const { error: insertError } = await supabase.from("events").insert({
      id: crypto.randomUUID(),
      name: "Mate's Unauthorized Event",
      date: "2024-01-01",
      venue: "Main Hall",
      type: "Conference",
      capacity: 100,
      organizer_id: (await supabase.auth.getUser()).data.user?.id,
    });
    
    if (insertError) {
      console.log("✅ Passed: Mate was blocked from creating an event.");
    } else {
      console.log("❌ Failed: Mate was able to create an event!");
    }
  }

  // 2. Test President Can Insert Event
  console.log("\n[Test 2] President can insert event");
  await supabase.auth.signInWithPassword({
    email: demoAccounts.president,
    password: "password123",
  });
  
  const { data: { user: presUser } } = await supabase.auth.getUser();
  const testEventId = crypto.randomUUID();
  
  const { error: presInsertError } = await supabase.from("events").insert({
    id: testEventId,
    name: "President's Authorized Event",
    date: "2024-01-01",
    venue: "Main Hall",
    type: "Conference",
    capacity: 100,
    organizer_id: presUser?.id,
  });
  
  if (!presInsertError) {
    console.log("✅ Passed: President created an event successfully.");
  } else {
    console.log("❌ Failed: President could not create an event.", presInsertError.message);
  }
  
  // Clean up test event
  if (!presInsertError) {
    await supabase.from("events").delete().eq("id", testEventId);
  }
  
  console.log("\nTests finished.");
}

runTests().catch(console.error);
