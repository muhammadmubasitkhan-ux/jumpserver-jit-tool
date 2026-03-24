# JumpServer JIT Access Portal — Frontend

A modern React + TypeScript UI for Just-In-Time privileged access workflows, built with Tailwind CSS and shadcn/ui.

## Quick Start

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Connecting to the Backend

Set the `VITE_API_BASE_URL` environment variable to point to your backend:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8000
```

The frontend proxies all API calls to this base URL with credentials included (cookies).

## Pages & Routes

| Route | Role | Description |
|---|---|---|
| `/auth/login` | Public | Login page |
| `/request` | Requester | Submit JIT access request |
| `/request/my` | Requester | View request history |
| `/approvals` | Admin | Approve/deny/revoke requests |
| `/dashboard` | Admin | Stats, health, active grants |

## Architecture

- **`src/lib/api.ts`** — Typed API service layer with all endpoint integrations
- **`src/contexts/AuthContext.tsx`** — Auth state management (cookie-based sessions)
- **`src/components/AppShell.tsx`** — Layout with role-based navigation
- **`src/components/`** — Reusable UI components (StatusBadge, EmptyState, ErrorState)
- **`src/pages/`** — All route pages

## Design System

Colors, spacing, and typography are defined in `src/index.css` using CSS custom properties and consumed via `tailwind.config.ts`. All components use semantic tokens — never hardcoded colors.
