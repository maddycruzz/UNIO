# UNIO – Event Management Dashboard

UNIO is a complete event management and coordination dashboard built with Next.js. It provides a centralized, persistent platform for organizers to plan, track, and execute events efficiently.

## 🚀 Features

- **Centralized Data Store:** All actions (creating events, tasks, meetings, checking in participants) are saved using a global state layer powered by `localStorage`, allowing data to persist across page reloads.
- **Dynamic Dashboard:** Real-time completion statistics, upcoming events, and active tasks automatically update based on your activity.
- **Event Management:** Create, view, edit, and delete events with capacities, schedules, and specific types.
- **Task Tracking:** Assign and track tasks for different events across your team. Drag-and-drop or cycle statuses between To Do, In Progress, and Done.
- **Meeting Scheduler:** Track ongoing and upcoming coordination syncs and take notes for specific meetings.
- **Participant Check-ins:** Manage event registrations and check participants in seamlessly. Export attendance data to CSV/Excel.
- **Certificate Generator:** Integrated canvas editor (powered by Fabric.js) allows organizers to design, customize, and generate certificates for attendees directly within the platform.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Certificate Editor:** [Fabric.js](http://fabricjs.com/)
- **Drag & Drop:** [@dnd-kit](https://dndkit.com/)

## 💻 Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The application will automatically seed itself with sample data on your first visit!

## 📦 Build for Production

To create an optimized production build:

```bash
npm run build
npm start
```
