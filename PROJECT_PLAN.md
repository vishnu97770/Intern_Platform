# Intern Platform — Project Plan

## Vision

> Upload your resume once → configure your preferences once → discover
> relevant internships → automatically apply according to your rules →
> track everything in one place.

This document is the living architecture and phase-tracking record for the
platform. Update it as phases complete or decisions change.

## Architecture Overview

```
apps/web        React SPA (student-facing dashboard)
apps/api        Node.js/Express API (REST) + business logic + Prisma ORM
packages/shared Shared TypeScript types & cross-cutting interfaces
                (ResumeParser, JobDescriptionParser, MatchingEngine,
                 InternshipProvider, ApplicationProvider)
```

```
Frontend (apps/web)
      │  HTTPS / JSON (Authorization: Bearer <access token>)
      ▼
Backend API (apps/api)
      │
      ├── modules/auth          — registration, login, refresh, logout
      ├── modules/profile       — student profile CRUD (education, skills,
      │                           projects, experience, certifications)
      ├── modules/resume        — (Phase 2) upload, parse, review
      ├── modules/internships   — (Phase 3) provider abstraction, listing
      ├── modules/matching      — (Phase 4) MatchingEngine implementations
      ├── modules/applications  — (Phase 5) ApplicationEngine, tracking
      ├── modules/auto-apply    — (Phase 6) rules, queue, worker
      └── modules/notifications — (Phase 6) delivery + in-app feed
      │
      ▼
PostgreSQL (via Prisma)      Redis (via BullMQ, Phase 6+ background jobs)
```

Business logic lives in `*.service.ts` files, never in route handlers.
Route handlers (`*.controller.ts` + `*.routes.ts`) only: validate input,
call a service, shape the HTTP response. This keeps logic testable without
spinning up an HTTP server and keeps the door open to exposing the same
services over another transport (e.g. a worker process, a CLI, a future
GraphQL layer) later.

## Why these technology choices

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript everywhere | One type system shared via `packages/shared` between API and web; catches contract drift at compile time. |
| Backend framework | Express + TypeScript | Minimal, well understood, easy to layer clean architecture on top of without fighting framework conventions. |
| ORM / migrations | Prisma | Type-safe queries, first-class migration tooling, easy to reason about schema evolution. |
| Database | PostgreSQL | Relational integrity for users/applications/matches; strong JSON support for flexible fields (skills lists, requirements) when needed. |
| Auth | Self-issued JWT (short-lived access + rotating refresh cookie) | No third-party dependency for the core account system; refresh tokens are stored hashed and revocable. |
| Frontend | React + Vite + TypeScript | Fast dev loop, large ecosystem, straightforward SPA routing for a dashboard-style product. |
| Styling | Tailwind CSS | Consistent design tokens without hand-rolling a CSS architecture this early. |
| Background jobs (Phase 6+) | BullMQ + Redis | Durable job queue for discovery/matching/auto-apply/retries; doesn't require the student's browser to stay open. |
| Testing | Vitest | Same tool for API and web; fast, native ESM/TS support. |

## Data Model (evolves per phase)

Phase 1 introduces: `User`, `RefreshToken`, `StudentProfile`, `Skill`,
`StudentSkill`, `Project`, `Experience`, `Certification`.

Phase 2 adds: `Resume` (file metadata + parsed proposal; never applied to
`StudentProfile` until the student calls `POST /resume/:id/confirm`).

Future phases will add (not yet created — avoiding unused tables until the
phase that needs them lands):

```
InternshipProvider, Internship, InternshipSkill, MatchResult,
AutoApplyRule, Application, ApplicationAttempt, Notification
```

Full target ERD for reference:

```
User 1─1 StudentProfile 1─* Project
                        1─* Experience
                        1─* Certification
                        *─* Skill (via StudentSkill)
                        1─* Resume (Phase 2)
                        1─* AutoApplyRule (Phase 6)

Internship *─1 InternshipProvider
Internship *─* Skill (via InternshipSkill)
Internship 1─* MatchResult *─1 StudentProfile
Internship 1─* Application *─1 StudentProfile
Application 1─* ApplicationAttempt
User 1─* Notification
```

## Phase Tracker

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: project structure, auth, student profile | Done |
| 2 | Resume upload, extraction, parsing, review | Done |
| 3 | Internship schema, provider abstraction, listing | Not started |
| 4 | Matching engine, recommendations | Not started |
| 5 | Application tracking, manual apply flow | Not started |
| 6 | Auto-apply rules, queue, background workers | Not started |
| 7 | Production hardening | Not started |

## Key Interfaces (defined early, implemented incrementally)

- `ResumeParser` — `parse(fileBuffer, mimeType): ParsedResume` (Phase 2)
- `JobDescriptionParser` — `parse(rawText): ParsedRequirements` (Phase 3/4)
- `MatchingEngine` — `score(profile, internship): MatchResult` (Phase 4)
- `InternshipProvider` — `fetchListings(): RawInternship[]` (Phase 3)
- `ApplicationProvider` — `submit(application): ApplicationResult` (Phase 6)

Defining these now (in `packages/shared`) means later phases plug in
implementations without reshaping the modules that already depend on them.

## Non-goals / explicit restrictions

- No CAPTCHA bypass, anti-bot evasion, or unauthorized scraping.
- No credential storage for third-party sites on the student's behalf beyond
  what a legitimate, documented integration requires.
- Auto-apply is opt-in and inert until the student explicitly enables it;
  it can be disabled instantly and every decision is logged with a reason.
