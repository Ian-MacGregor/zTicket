# zTicket — Frontend

zTicket is an internal ticketing system developed for software engineers but it could apply to other industries as well. zTicket is modular and "self hosted" (to a degree; see below). This repo contains the code required to build the first of the three modules that makeup zTicket, the frontend. The frontend for zTicket (this repo) is built with React, Vite, and Supabase Auth and is deployed to GitHub Pages. This frontend module interacts with a small API server (the API is built using the Hono web framework -- a Node.js runtime enviornment deployed via Docker container; repo link below) which controls interactions with the application's PostgreSQL database (the third module; the SQL used to build this DB is in the backend repo linked below). 

This application is designed to be hosted in as efficient a manner as possible for the average developer/home user. Specifically, the frontend is hosted free on GitHub's Pages, the API is hosted on Railway ($5 a month after the first free month), and the database is hosted on Supabase (free with usage limits).  Each of these hosts offer easy scaling and migration.

The repo for the backend of this application (the API module and the SQL for the database module) is here: https://github.com/Ian-MacGregor/zTicket-api

---

## Stack

- **React 18** with TypeScript
- **Vite** for bundling
- **React Router** for client-side routing
- **Supabase JS** for authentication (email/password)
- **GitHub Pages** for hosting via GitHub Actions

---

## Pages

### Login / Register (`/login`)
Email and password authentication powered by Supabase. Only email addresses added to the `allowed_emails` table in the database can register. New accounts require email confirmation.

### Dashboard (`/`)
The main view showing all tickets across the company. Features include:

- **Activity feed** — a subtle bar between the title bar and the stat cards showing the 5 most recent ticket events (e.g. "#123 Taylor set status to "Review" · 5m ago"). Refreshes every 30 seconds and immediately after any status change.
- **Stat cards** — clickable filter cards showing global ticket counts. Cards: Active (assigned + review combined), Unassigned, Wait/Hold, Assigned, Review, Done, Total. Counts always reflect the whole database regardless of active filters. Clicking a card filters the list to that status; clicking "Total" resets all filters. The active filter card is highlighted. **Active is the default filter** when the page loads.
- **Pagination** — tickets are loaded 10 per page by default (configurable to 25, 50, or 100). All filtering, sorting, and searching is performed server-side so sort order and result counts are accurate across the full dataset.
- **Filters** — priority and client dropdowns. Status filtering via stat card clicks.
- **Search** — joined type selector + text input. Search types: description, ticket #, client, assignee, reviewer, date created, date updated. Search is debounced and runs server-side.
- **Column header sorting** — click any column header (# / Status / Description / Client / Priority / Owner / Dates) to sort by that column; click again to reverse. Active sort column shows ↑ or ↓ indicator.
- **My Tickets / My Reviews** — quick-filter buttons that show tickets assigned to or awaiting review by the current user.
- **Inline status changes** — the status dropdown on each ticket row updates the ticket immediately without leaving the dashboard. Changing to "assigned" from "unassigned" opens a user-picker modal; changing to "wait/hold" prompts for a reason.
- **Visual highlights** — tickets assigned to the current user get a colored outline matching the "assigned" status color. Tickets awaiting the current user's review get an outline matching the "review" status color.
- **Skeleton loading** — stat cards and ticket rows show animated placeholders while data loads. The column header row is always visible during loading to prevent visual flicker.
- **Auto-refresh** — ticket list, stat cards, and activity feed refresh automatically every 30 seconds without a visible flash.

### Ticket Detail (`/tickets/:id`)
Full ticket view showing all metadata, file attachments, Gmail links, and forum-style comments. From here you can upload files, download all files as a zip, delete individual files, or navigate to edit the ticket. The status field is an inline dropdown — changing it saves immediately with the same modal prompts as the dashboard (user picker for "assigned", reason prompt for "wait/hold").

Fields displayed: reference number, title, description, status (editable dropdown), priority, assigned developer, reviewer, client, created by, date created, date done, quoted fields (only shown when Quote Required is enabled), wait/hold reason (only shown when status is wait/hold), Gmail links, and attached files.

**Comments** — a full forum-style thread beneath the ticket metadata. Each comment shows the author's name, timestamp, and an "(edited)" marker if it has been updated. Authors see an Edit button on their own comments (RLS enforces this server-side too). An "Add Comment" box is always visible at the bottom of the thread.

### Create / Edit Ticket (`/tickets/new`, `/tickets/:id/edit`)
Form for creating or editing tickets. Fields include:

- Title and description
- Priority and status (status only shown when editing)
- Assigned developer and reviewer (dropdowns populated from registered users)
- Client (dropdown populated from the clients list)
- **Quote Required** checkbox — when unchecked (default), the quoted fields are hidden and cleared on save. When checked, the following three fields appear:
  - Quoted time (free text, e.g. "2 weeks" or "40 hours")
  - Quoted price and quoted AMF increase (dollar amounts)
- Gmail links (add multiple)
- Wait/hold reason (only shown when status is set to Wait/Hold)
- **Initial comment** (create mode only) — an optional first comment posted immediately after the ticket is created

### Clients (`/clients`)
Manage the client list and their contacts. Each client has a name and a contact list. Contacts have a name, email, phone, and role/title. Clients appear in the ticket form dropdown and as filter options on the dashboard.

### Colors (`/colors`)
Per-user color customization with three categories:

- **Foreground / Background** — controls the card color, page background, button color, and two text shades across the entire app.
- **Statuses** — sets the color for each status badge (unassigned, wait/hold, assigned, review, done), the stat card indicators, and the ticket highlight outlines (for assigned and review statuses only).
- **Priorities** — sets the color for each priority label (critical, high, medium, low).

Each color can be set via a native color wheel or by entering a hex (`#RRGGBB`) or ARGB (`FFRRGGBB`) code. A live preview shows two mock ticket rows using the draft colors before saving. Color settings are per-user and persist across sessions.

---

## Project Structure

```
zTicket/
├── .github/
│   └── workflows/
│       └── deploy.yml        # Auto build + deploy on push to master
├── public/
│   ├── 404.html              # SPA redirect for GitHub Pages
│   └── favicon.svg           # Browser tab icon (ticket shape with "z"; hardcoded gold — static files can't use CSS variables)
├── src/
│   ├── App.tsx                # Router, auth guard, providers
│   ├── main.tsx               # React entry point
│   ├── styles.css             # All application styles
│   ├── components/
│   │   └── TicketIcon.tsx     # Reusable SVG ticket icon (stroke="currentColor", responds to user's button color)
│   ├── hooks/
│   │   ├── useAuth.tsx        # Auth context (Supabase session)
│   │   └── useColors.tsx      # Color settings context (CSS variables)
│   ├── lib/
│   │   ├── api.ts             # API client (all fetch calls to Hono API)
│   │   └── supabase.ts        # Supabase client init
│   └── pages/
│       ├── LoginPage.tsx
│       ├── DashboardPage.tsx
│       ├── TicketFormPage.tsx
│       ├── TicketDetailPage.tsx
│       ├── ClientsPage.tsx
│       └── ColorsPage.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .env                       # Enviornment variables (not to be committed, just for local testing)
```

---

## Environment Variables

Create a `.env` file in the project root (not committed to git):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://your-api.railway.app
```

These are also configured as GitHub Actions secrets for the CI/CD pipeline (see Deployment below).

---

## Local Development

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` by default. Requires the API server and Supabase project to be running.

---

## Deployment

The app auto-deploys to GitHub Pages on every push to `master` via the `.github/workflows/deploy.yml` workflow.

### How it works

1. The workflow checks out the code, installs dependencies, and runs `vite build`.
2. Environment variables are injected from GitHub Actions secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`).
3. The built `dist/` folder is pushed to the `gh-pages` branch.
4. GitHub Pages serves from the `gh-pages` branch.

### Initial setup

1. Go to your repo → **Settings → Secrets and variables → Actions** and add the three secrets listed above.
2. Go to **Settings → Pages** and set the source to the `gh-pages` branch, root `/`.
3. Update `vite.config.ts` `base` and `App.tsx` `BrowserRouter basename` to match your repo name.
4. Push to `master` — the workflow handles the rest.

### Manual build (optional)

```bash
npm run build
```

This creates a `dist/` folder. You no longer need to run `npm run deploy` manually unless you want to bypass the CI pipeline.

---

## Authentication Flow

1. User enters email and password on the login page.
2. Supabase Auth handles signup/signin. A database trigger (`check_allowed_email`) blocks signups from emails not in the `allowed_emails` table.
3. On signup, another trigger (`handle_new_user`) creates a profile row automatically.
4. The frontend stores the session token and sends it as a `Bearer` token to the Hono API for all authenticated requests.

---

## Color System

Colors are managed through CSS custom properties on `:root`. The `useColors` context:

1. Loads the current user's saved color settings from the API on login.
2. Merges them with defaults (so new users get the base dark theme).
3. Applies them as `style.setProperty()` calls on `document.documentElement`.
4. Every component that uses `var(--bg-card)`, `var(--status-assigned)`, etc. automatically picks up changes with no per-component logic.

Default theme is a dark industrial-minimal palette with warm gold accents.

The `TicketIcon` SVG component (used in the login page header and dashboard topbar) uses `stroke="currentColor"`, so it automatically picks up the user's configured button color via CSS. The `public/favicon.svg` browser tab icon uses the same ticket shape but with a hardcoded default color since static files cannot access CSS variables.
