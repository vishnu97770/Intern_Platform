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

Phase 3 adds: `InternshipProvider`, `Internship`, `InternshipSkill`.
Duplicate prevention is a `@@unique([providerId, externalId])` constraint,
so re-ingesting the same provider's feed upserts instead of duplicating.

Phase 4 adds: `MatchResult` — a cached, deterministic score per
(student, internship) pair, unique on `[studentProfileId, internshipId]`
so recalculating upserts instead of accumulating history rows.

Phase 5 adds: `Application` (unique on `[studentProfileId, internshipId]`
— since Internship is already deduplicated by provider+externalId, this
transitively prevents duplicate applications to the same posting) and
`ApplicationAttempt` (append-only audit trail; every status change that
represents a real submission/outcome adds a row rather than overwriting).

Phase 6 adds: `AutoApplyRule` — one row per student (upserted, not a
list), disabled and requiring manual approval by default. Background
processing (BullMQ queues, namespaced per NODE_ENV so tests never share
a queue with the running dev/production worker):
`auto-apply-submit-*` (one job per submission, 3 retries with exponential
backoff) and `auto-apply-scan-*` (a repeatable job, every
`AUTO_APPLY_SCAN_INTERVAL_MS`, that runs the pipeline for every student
with auto-apply enabled). See `ApplicationProvider` (packages/shared) and
`modules/auto-apply/providers/` — no real internship source has a
technically/contractually supported automated application channel yet,
so the only registered provider is a demo/simulation against
MockInternshipProvider's own fabricated domain; every other internship
correctly resolves to "Manual Application Required" with the official
link, never a scrape or bypass attempt.

Future phases will add (not yet created — avoiding unused tables until the
phase that needs them lands):

```
Notification
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
| 3 | Internship schema, provider abstraction, listing | Done |
| 4 | Matching engine, recommendations | Done |
| 5 | Application tracking, manual apply flow | Done |
| 6 | Auto-apply rules, queue, background workers | Done |
| 7 | Production hardening | Done |
| 8 | External LLM-assisted parsing (Groq/Together/OpenRouter) | Done |

## Key Interfaces (defined early, implemented incrementally)

- `ResumeParser` — `parse(fileBuffer, mimeType): ParsedResume` (Phase 2)
- `JobDescriptionParser` — `parse(rawText): ParsedRequirements` (Phase 3/4)
- `MatchingEngine` — `score(profile, internship): MatchResult` (Phase 4)
- `InternshipProvider` — `fetchListings(): RawInternship[]` (Phase 3)
- `ApplicationProvider` — `submit(application): ApplicationResult` (Phase 6)

Defining these now (in `packages/shared`) means later phases plug in
implementations without reshaping the modules that already depend on them.

## Phase 8 — External LLM providers (Groq / Together AI / OpenRouter)

Three external API credentials became available: `GROQ_API_KEY`,
`TOGETHER_API_KEY`, `OPENROUTER_API_KEY` (each paired with a `*_MODEL`
variable). All three are general-purpose hosted LLM chat-completion APIs
(OpenAI-compatible), **not** internship/job-board or ATS APIs — so they
integrate behind `ResumeParser` and `JobDescriptionParser`, not
`InternshipProvider`/`ApplicationProvider`. Fabricating an
`InternshipProvider` on top of a chat API (i.e. asking an LLM to "find
internships") would mean risking hallucinated listings — not something
this platform does. `MockInternshipProvider` and `MockApplicationProvider`
remain the active providers until a real job-board/ATS API is available.

Architecture:

```
lib/llm/llmClient.ts          Cascading OpenAI-compatible chat client:
                               tries Groq → Together → OpenRouter in order,
                               each provider once, bounded by
                               LLM_TIMEOUT_SECONDS per call and
                               LLM_TOTAL_BUDGET_SECONDS overall. Never
                               retries a failed provider — falls through
                               to the next one instead, so this can never
                               become an aggressive request loop.

resume/parsers/llmResumeParser.ts           LLM-backed ResumeParser
internships/parsers/llmJobDescriptionParser.ts  LLM-backed JobDescriptionParser

resume/parsers/index.ts       FallbackResumeParser: tries the LLM parser
internships/parsers/index.ts  FallbackJobDescriptionParser: same pattern
                               when at least one provider is configured,
                               falls back to the deterministic parser on
                               ANY failure. Always deterministic-only in
                               NODE_ENV=test — the test suite never depends
                               on live external API calls, even though the
                               real API keys are present in .env locally.
```

Every field from an LLM completion is treated as untrusted input: parsed
through a Zod schema with a `.catch()` default per field (one malformed
field degrades to `null`/`[]` rather than failing the whole parse), skill
names are resolved against the existing skills dictionary (never trusted
as-is — this is what keeps a confirmed skill mapped to the same `Skill`
row the deterministic parser and matching engine already use), and every
string/array is length-capped to what the existing profile/internship
validators accept.

**Known local configuration issue (as of the last verification pass):** a
manual smoke test against the three live APIs found `GROQ_MODEL` pointing
at a model the configured key can't access (HTTP 404), and both
`TOGETHER_MODEL` and `OPENROUTER_MODEL` holding what look like API-key-shaped
strings rather than real model identifiers (HTTP 404/400). Until these
`.env` values are corrected, `isLlmEnabled()` still reports the providers
as "configured" (key + model both present), but every real call fails and
the fallback registries transparently drop back to the deterministic
parser — proven both by the automated fallback tests and by this
misconfiguration itself, live. No code change is needed once the `.env`
values are fixed to real model identifiers from each provider's dashboard.

## Non-goals / explicit restrictions

- No CAPTCHA bypass, anti-bot evasion, or unauthorized scraping.
- No credential storage for third-party sites on the student's behalf beyond
  what a legitimate, documented integration requires.
- Auto-apply is opt-in and inert until the student explicitly enables it;
  it can be disabled instantly and every decision is logged with a reason.
