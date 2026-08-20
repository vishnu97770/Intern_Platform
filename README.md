# Intern Platform

A platform that helps college students go from resume to internship
applications with less manual effort:

> Upload your resume once → configure your preferences once → discover
> relevant internships → automatically apply according to your rules →
> track everything in one place.

See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the full architecture,
technology rationale, data model, and phase-by-phase build plan.

## Project structure

```
apps/
  api/       Backend API (Node.js + Express + TypeScript + Prisma)
  web/       Frontend SPA (React + Vite + TypeScript + Tailwind CSS)
packages/
  shared/    Shared types and cross-cutting interfaces (ResumeParser,
             MatchingEngine, InternshipProvider, ApplicationProvider, ...)
```

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL + Redis via `docker-compose.yml`)

## Getting started

```bash
# 1. Install dependencies for every workspace
npm install

# 2. Create your local environment file
cp .env.example .env
# then fill in DATABASE_URL-related values and generate JWT secrets, e.g.:
#   openssl rand -base64 48

# 3. Start local Postgres + Redis
npm run db:up

# 4. Apply database migrations
npm run -w @intern-platform/api prisma:migrate

# 5. Run the API and web app (separate terminals)
npm run dev:api
npm run dev:web
```

The API listens on `http://localhost:4000` and the web app on
`http://localhost:5173` by default (see `.env.example`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev:api` | Run the backend API in watch mode |
| `npm run dev:web` | Run the frontend dev server |
| `npm run build` | Build all workspaces |
| `npm test` | Run all test suites |
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run db:up` / `npm run db:down` | Start/stop local Postgres + Redis |

## Security notes

- Never commit `.env` — only `.env.example` (placeholders) is tracked.
- Passwords are hashed with bcrypt; JWT access tokens are short-lived and
  refresh tokens are stored hashed and revocable.
- Auto-apply is disabled by default and never enabled silently — see
  `PROJECT_PLAN.md` for the full rule/authorization model.
