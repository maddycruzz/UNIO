import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket as any }
});

async function runSeed() {
  console.log("Seeding UNIO Live Database with Event Data...");

  // 1. Log in as Ayaan (President)
  const { error: loginError, data } = await supabase.auth.signInWithPassword({
    email: "ayaan@college.edu",
    password: "password123",
  });
  
  if (loginError) {
    console.error("Failed to login as Ayaan:", loginError.message);
    return;
  }
  
  const userId = data.user?.id;
  console.log(`Successfully logged in as President Ayaan Nizam (ID: ${userId})`);

  // Get all events owned by Ayaan to clean them up
  const { data: myEvents } = await supabase.from("events").select("id").eq("organizer_id", userId);
  const myEventIds = (myEvents || []).map(e => e.id);
  
  if (myEventIds.length > 0) {
    console.log("Cleaning up previous seed data...");
    await supabase.from("tasks").delete().in("event_id", myEventIds);
    await supabase.from("meetings").delete().in("event_id", myEventIds);
    await supabase.from("participants").delete().in("event_id", myEventIds);
    await supabase.from("events").delete().in("id", myEventIds);
  }

  // 2. Insert Events
  console.log("Inserting events...");
  const events = [
    {
      id: 'spring-fest-night-market',
      organizer_id: userId,
      name: 'Spring Fest Night Market',
      type: 'Cultural',
      description: 'Night market featuring food stalls, performances, and club showcases across the quad.',
      date: 'Mar 28 · 7:00 PM',
      venue: 'Central Quad',
      participants: 200,
      capacity: 300,
      completion: 78,
      status: 'upcoming',
      tasks_done: 12,
      tasks_total: 16,
      days_remaining: 5,
      assignees: ['AK', 'MS', 'JR'],
      start_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    },
    {
      id: 'ai-campus-panel',
      organizer_id: userId,
      name: 'AI in Campus Life Panel',
      type: 'Conference',
      description: 'Faculty, founders, and students discuss the role of AI on campus life.',
      date: 'Today · 5:30 PM',
      venue: 'Auditorium A',
      participants: 160,
      capacity: 200,
      completion: 92,
      status: 'ongoing',
      tasks_done: 18,
      tasks_total: 20,
      days_remaining: 0,
      assignees: ['RS', 'LT', 'NP'],
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
    },
    {
      id: 'founders-pitch-night',
      organizer_id: userId,
      name: 'Founders Club Pitch Night',
      type: 'Tech',
      description: 'Student founders pitch to alumni, angels, and faculty mentors.',
      date: 'Tomorrow · 7:00 PM',
      venue: 'Innovation Hub',
      participants: 120,
      capacity: 150,
      completion: 54,
      status: 'upcoming',
      tasks_done: 7,
      tasks_total: 13,
      days_remaining: 1,
      assignees: ['AK', 'DL', 'HS'],
      start_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    }
  ];

  const { error: eventErr } = await supabase.from("events").insert(events);
  if (eventErr) {
    console.error("Error inserting events:", eventErr.message);
    return;
  }
  console.log("Event details inserted successfully.");

  // 3. Insert Tasks
  console.log("Inserting tasks...");
  const tasks = [
    {
      id: 't1',
      organizer_id: userId,
      event_id: 'spring-fest-night-market',
      title: 'Lock venue and timings',
      event: 'Spring Fest Night Market',
      event_color: '#6366F1',
      priority: 'High',
      status: 'done',
      due: '2026-03-15',
      assignees: [{ i: 'AK', c: '#6366F1' }, { i: 'RS', c: '#10B981' }],
      description: 'Confirm auditorium booking and finalize event timings with admin.',
      division: 'General',
      order: 1
    },
    {
      id: 't3',
      organizer_id: userId,
      event_id: 'spring-fest-night-market',
      title: 'Design posters and social assets',
      event: 'Spring Fest Night Market',
      event_color: '#6366F1',
      priority: 'Medium',
      status: 'todo',
      due: '2026-03-28',
      assignees: [{ i: 'JR', c: '#EC4899' }, { i: 'AK', c: '#6366F1' }],
      description: 'Create Instagram, WhatsApp, and print poster assets.',
      division: 'General',
      order: 2
    },
    {
      id: 't5',
      organizer_id: userId,
      event_id: 'spring-fest-night-market',
      title: 'Plan food stalls and logistics',
      event: 'Spring Fest Night Market',
      event_color: '#6366F1',
      priority: 'Medium',
      status: 'inprogress',
      due: '2026-03-26',
      assignees: [{ i: 'AK', c: '#6366F1' }],
      description: 'Contact vendors and allocate stall positions on campus map.',
      division: 'General',
      order: 3
    },
    {
      id: 't7',
      organizer_id: userId,
      event_id: 'founders-pitch-night',
      title: 'Confirm judges panel',
      event: 'Founders Club Pitch Night',
      event_color: '#10B981',
      priority: 'High',
      status: 'done',
      due: '2026-03-12',
      assignees: [{ i: 'AK', c: '#6366F1' }, { i: 'HS', c: '#F97316' }],
      description: 'Finalize 4 alumni + 2 faculty judges and share briefing doc.',
      division: 'General',
      order: 1
    },
    {
      id: 't11',
      organizer_id: userId,
      event_id: 'founders-pitch-night',
      title: 'Coordinate AV and stage setup',
      event: 'Founders Club Pitch Night',
      event_color: '#10B981',
      priority: 'High',
      status: 'inprogress',
      due: '2026-03-27',
      assignees: [{ i: 'AK', c: '#6366F1' }, { i: 'DL', c: '#14B8A6' }],
      description: 'Ensure projector, mics, and livestream are configured.',
      division: 'General',
      order: 2
    },
    {
      id: 't12',
      organizer_id: userId,
      event_id: 'founders-pitch-night',
      title: 'Finalize event schedule',
      event: 'Founders Club Pitch Night',
      event_color: '#10B981',
      priority: 'Medium',
      status: 'todo',
      due: '2026-04-01',
      assignees: [{ i: 'AK', c: '#6366F1' }],
      description: 'Create minute-by-minute schedule and share with all stakeholders.',
      division: 'General',
      order: 3
    },
    {
      id: 't9',
      organizer_id: userId,
      event_id: 'ai-campus-panel',
      title: 'Send speaker invites',
      event: 'AI in Campus Life Panel',
      event_color: '#F59E0B',
      priority: 'High',
      status: 'done',
      due: '2026-03-08',
      assignees: [{ i: 'RS', c: '#10B981' }, { i: 'AK', c: '#6366F1' }],
      description: 'Email confirmed speakers with schedule, venue, and logistics.',
      division: 'General',
      order: 1
    },
    {
      id: 't13',
      organizer_id: userId,
      event_id: 'ai-campus-panel',
      title: 'Draft event communications',
      event: 'AI in Campus Life Panel',
      event_color: '#F59E0B',
      priority: 'Low',
      status: 'todo',
      due: '2026-04-05',
      assignees: [{ i: 'AK', c: '#6366F1' }],
      description: 'Write announcement posts for college newsletter and social media.',
      division: 'General',
      order: 2
    }
  ];

  const { error: taskErr } = await supabase.from("tasks").insert(tasks);
  if (taskErr) {
    console.error("Error inserting tasks:", taskErr.message);
    return;
  }
  console.log("Tasks inserted successfully.");

  // 4. Insert Meetings
  console.log("Inserting meetings...");
  const meetings = [
    {
      id: 'm1',
      organizer_id: userId,
      event_id: 'spring-fest-night-market',
      title: 'Spring Fest Kickoff Sync',
      event: 'Spring Fest Night Market',
      event_color: '#6366F1',
      date: '2026-03-04',
      time: '10:00',
      duration: 60,
      location: 'Room 204, Admin Block',
      status: 'completed',
      attendees: [{ i: 'AK', c: '#6366F1' }, { i: 'RS', c: '#10B981' }, { i: 'SP', c: '#EC4899' }],
      agenda: '1. Confirm venue booking\n2. Assign stall coordinators\n3. Set deadlines for design assets',
      notes: 'Venue confirmed for March 28. Riya to handle stall assignments by March 10. Design assets deadline set to March 20.',
    },
    {
      id: 'm2',
      organizer_id: userId,
      event_id: 'founders-pitch-night',
      title: 'Judges Briefing — Pitch Night',
      event: 'Founders Club Pitch Night',
      event_color: '#10B981',
      date: '2026-03-06',
      time: '15:30',
      duration: 45,
      location: 'Innovation Hub, Level 2',
      status: 'completed',
      attendees: [{ i: 'AK', c: '#6366F1' }, { i: 'HS', c: '#F97316' }, { i: 'DL', c: '#14B8A6' }],
      agenda: '1. Walk judges through scoring rubric\n2. Confirm schedule and timings\n3. Share team bios',
      notes: 'All 6 judges confirmed. Scoring rubric approved. Bios to be collected by March 15.',
    },
    {
      id: 'm3',
      organizer_id: userId,
      event_id: 'founders-pitch-night',
      title: 'AV & Stage Setup Review',
      event: 'Founders Club Pitch Night',
      event_color: '#10B981',
      date: '2026-03-10',
      time: '11:00',
      duration: 30,
      location: 'Google Meet',
      status: 'ongoing',
      attendees: [{ i: 'AK', c: '#6366F1' }, { i: 'DL', c: '#14B8A6' }],
      agenda: '1. Projector and mic check\n2. Livestream configuration\n3. Run-of-show walkthrough',
      notes: '',
    }
  ];

  const { error: meetErr } = await supabase.from("meetings").insert(meetings);
  if (meetErr) {
    console.error("Error inserting meetings:", meetErr.message);
    return;
  }
  console.log("Meetings inserted successfully.");

  // 5. Insert Participants
  console.log("Inserting participants...");
  const participants = [
    {
      id: 'p1',
      organizer_id: userId,
      event_id: 'spring-fest-night-market',
      name: 'Priya Sharma',
      email: 'priya@college.edu',
      phone: '+91 98765 43210',
      roll_no: 'CS22B104',
      dept: 'Computer Science',
      status: 'registered',
      registered_at: '2 hours ago'
    },
    {
      id: 'p2',
      organizer_id: userId,
      event_id: 'spring-fest-night-market',
      name: 'Aravind Kumar',
      email: 'aravind@college.edu',
      phone: '+91 99999 88888',
      roll_no: 'EC22B005',
      dept: 'Electronics',
      status: 'checked-in',
      registered_at: '1 day ago'
    },
    {
      id: 'p3',
      organizer_id: userId,
      event_id: 'founders-pitch-night',
      name: 'Divya Lakshmi',
      email: 'divya@college.edu',
      phone: '+91 88888 77777',
      roll_no: 'EE23B082',
      dept: 'Electrical',
      status: 'registered',
      registered_at: '3 hours ago'
    }
  ];

  const { error: partErr } = await supabase.from("participants").insert(participants);
  if (partErr) {
    console.error("Error inserting participants:", partErr.message);
    return;
  }
  console.log("Participants inserted successfully.");

  console.log("\n🎉 Seeding complete! Database is fully populated with rich demo events.");
}

runSeed().catch(console.error);
