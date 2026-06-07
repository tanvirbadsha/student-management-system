# SMS Registry Module

## Overview

The SMS Registry Module is a role-based student administration system for managing enrolment records, programme fees, assessments and submissions, grading, published results, and staff/student dashboard summaries. Staff can maintain registry data and academic outcomes, while students can review their fees, submit work, and view results after publication.

## Tech Stack

- Next.js 14 (App Router)
- PostgreSQL
- Prisma ORM
- Shadcn UI
- Tailwind CSS
- TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or a hosted instance)

### Installation

1. Clone the repo.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL`.
4. Run `npx prisma migrate dev --name init`.
5. Run `npx prisma db seed`.
6. Run `npm run dev`.
7. Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Key                   | Description                                        | Example                                                                    |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string used by Prisma        | `postgresql://postgres:password@localhost:5432/sms_registry?schema=public` |
| `NEXTAUTH_SECRET`     | Secret reserved for authentication/session signing | `replace-with-a-long-random-secret`                                        |
| `NEXTAUTH_URL`        | Canonical application URL used by authentication   | `http://localhost:3000`                                                    |
| `NEXT_PUBLIC_APP_URL` | Public browser-facing application URL              | `http://localhost:3000`                                                    |

### Demo Accounts

All seeded accounts use the password `password123`.

| Name              | Email                           | Role    | Seed state                |
| ----------------- | ------------------------------- | ------- | ------------------------- |
| Dr Sarah Mitchell | `s.mitchell@college.ac.uk`      | Staff   | Registry staff            |
| Prof James Okafor | `j.okafor@college.ac.uk`        | Staff   | Registry staff            |
| Alice Nguyen      | `alice.nguyen@student.ac.uk`    | Student | Enrolled, partial payment |
| Ben Carter        | `ben.carter@student.ac.uk`      | Student | Enrolled, overdue         |
| Fatima Al-Hassan  | `fatima.alhassan@student.ac.uk` | Student | Fully paid                |
| Liam Brooks       | `liam.brooks@student.ac.uk`     | Student | Deferred, overdue         |
| Priya Sharma      | `priya.sharma@student.ac.uk`    | Student | Enrolled, partial payment |

### Role Toggle

The home page provides a demonstration role selector instead of a password login flow. Select **Staff** or **Student**, choose a seeded user from the dropdown, and the application enters that user's view. No password is required for this demonstration. To leave the current view or test another account, use the **Switch Role** button in the navigation bar.

## Feature Walkthrough

- **Student enrolment:** Staff can view, search, enrol, and update students under **Students**. Individual records include programme, status, fees, and registry details.
- **Fees and payments:** Staff can monitor overdue balances under **Fees** and record payments from a student's fee tab. Students see their payment progress and fee status from their dashboard and record.
- **Assessments and submissions:** Staff create and review assessments under **Assessments**. Students upload PDF or DOCX coursework from **My Submissions**.
- **Marksheet and results:** Staff grade submissions, publish results, and manage marksheets under **Marksheet**. Students see only published grades under **My Results**.

## AI Usage

I used OpenAI Codex throughout development as a coding assistant. It helped me break the assignment prompts into smaller implementation steps, compare the Prisma schema with the required API contracts, structure App Router route handlers, and identify edge cases that crossed client and server boundaries.

I did not treat generated code as finished output. I reviewed the database queries, response serialization, role filtering, and UI states against the requirements and the existing codebase. I also changed generated approaches when they did not fit the application. For example, the staff marksheet needed both summary counts and assessment submission counts, so I extended the response deliberately instead of making extra client requests. I also rejected a client-only submission restriction and added a server-side enrolment-status check so withdrawn or completed students cannot bypass the UI.

Another improvement was the results visibility flow. The initial implementation could only list published result records, which meant an ungraded submission disappeared from the student marksheet. I combined the student's submissions with published results client-side so an ungraded submission is shown as **Awaiting grade** without exposing an unpublished mark.

I validated the AI-assisted work with TypeScript checks, ESLint, Prettier, Prisma schema validation, production `next build` runs, and live API smoke requests against the seeded PostgreSQL data. I also checked exact validation messages and role-specific result filtering rather than relying only on compilation.

## Database Schema

See database.md for full schema documentation.

## Project Structure

```text
apps/web/
|-- app/          # App Router pages, layouts, loading/error UI, and API routes
|-- components/   # Reusable dashboard, fee, result, student, and navigation UI
|-- lib/          # Shared types, API client, Prisma client, utilities, and serializers
`-- prisma/       # Prisma schema and deterministic development seed

packages/ui/
`-- src/components/  # Shared Shadcn-style UI primitives used by the web app
```
