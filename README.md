# UNIO – Collaborative Event & Team Management Dashboard

UNIO is a state-of-the-art, high-performance event management and coordination dashboard built with **Next.js (App Router)** and **Supabase**. Tailored for student clubs, organizations, and campuses, UNIO simplifies event execution, collaborative tasks tracking, certificate generation, and live check-ins.

---

## ✨ Primary Features

### 🔐 Centralized Role-Based Access Control (RBAC)
- Three access levels: **Developer**, **Club President**, and **Club Mate**.
- **Unified Authentication Context:** A root-level `<AuthProvider>` wrapper prevents state synchronization lags, layout shifts, or context crashes.
- **Client-Side Supabase Mutations:** Database actions are integrated into a central, asynchronous `lib/db.ts` layer. This completely purges Next.js Server Actions, keeping browser `localStorage` auth state perfectly aligned with all database transactions.
- **Collaborative Row-Level Security (RLS):** Policies are configured with robust, club-wide checks so that Mates can collaborate, cycle task statuses, manage tasks, and organize meetings seamlessly.

### 📋 Next-Gen Task Management
- **Multi-Assignee Support:** Assign tasks to multiple team members concurrently. Includes a gorgeous, floating custom checkbox dropdown UI to manage assignees.
- **Drag-and-Drop Organization:** Drag tasks across custom divisions (General, Tech, PR, etc.) on the Event Details board (powered by `@dnd-kit`).
- **Interactive Checklists:** Instant task status cycling (To Do → In Progress → Done) and progress bar sync.

### 📅 Coordination & Scheduling
- **Meeting Scheduler:** Schedule coordination syncs, take live meeting notes, and log attendees.
- **Activity Logging:** Real-time log displaying all workspace events, participant sign-ups, and team updates.

### 🎫 Real-Time Participant Check-Ins
- **Live Syncing:** Real-time database listeners sync participant arrivals across check-in scanners.
- **Check-in Page:** Fully designed check-in workspace for quick walk-ins and QR-code check-ins.
- **Attendance Export:** Export registered and checked-in attendees directly to CSV.

### 🎓 Dynamic Certificate Designer
- **Fabric.js Canvas:** A robust, visually rich in-dashboard canvas designer to design, customize, and bulk-generate completion certificates for attendees.

---

## 🛠️ Technology Stack
- **Framework:** Next.js (App Router, Turbopack)
- **Database & Auth:** Supabase (Auth, RLS Policies, Realtime, RPC)
- **Styling:** CSS Modules / HSL-harmonized Custom Utility Palettes
- **Animations:** Framer Motion (for premium micro-interactions)
- **Canvas Editor:** Fabric.js (HTML5 Canvas tool)
- **State Management:** Reactive Event Dispatcher & Client Db Store

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-publishable-key
```

### 3. Initialize the Supabase Schema & Policies
To configure the PostgreSQL backend, navigate to the **SQL Editor** on your Supabase dashboard and execute the following SQL scripts in order:
1. `supabase_schema.sql` (Initial tables, columns, indexes, and triggers)
2. `supabase_rbac_migration.sql` (Roles enum, club membership structure, and base RLS)
3. `supabase_rbac_migration_v2.sql` (Workspace isolation helper functions)
4. `supabase_rbac_migration_v3.sql` (Profiles sharing & team access policy improvements)
5. `supabase_rbac_migration_v4.sql` (Collaborative RLS permission updates for Tasks/Meetings)

### 4. Seed Demo Data (Optional)
Run the queries in `supabase_seed_demo.sql` to populate sample events, teams, and tasks for previewing the platform immediately.

### 5. Run the Local Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view your dashboard.

---

## 📁 Project Architecture
```
├── app/
│   ├── admin/                # Admin Panel (Developer Role only)
│   ├── auth/                 # Callback handlers, invite acceptances
│   ├── dashboard/            # Core views (events, tasks, meetings, team)
│   ├── login/                # Authentication page (OAuth & Password)
│   ├── layout.tsx            # Global layout wrapped in Providers
│   └── providers.tsx         # Central Client Providers wrapper
├── lib/
│   ├── auth.tsx              # Auth Context, login/signup/OAuth controllers
│   ├── db.ts                 # Central client-side data & Supabase layer
│   ├── store.ts              # LocalStorage fallback engine
│   └── supabase.ts           # Supabase JS client initializer
```

---

## 🔮 What's Next & Roadmap
- [ ] **Secure Invite Domain Validation:** Restrict workspace joins to specific university email domains.
- [ ] **Canvas Auto-Mapping:** Bind attendee lists dynamically to Fabric.js text layers during certificate bulk generation.
- [ ] **QR Scanner Camera API Integration:** Integrate full camera frame reading for the QR attendance scanner on mobile browsers.
- [ ] **Push Notification system:** Trigger browser push notifications for high-priority task deadlines.
