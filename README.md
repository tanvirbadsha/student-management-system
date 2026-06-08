# Student Management System - Registry Module

This project is a role-based Student Management System built as a company job assignment. It models the core workflows a college Registry team needs in one place: student enrolment, programme and module management, fees and payments, assessments, submissions, grading, published results, and student self-service.

The application has two main experiences:

- **Staff** manage operational registry data: students, programmes, modules, fees, assessments, submissions, marksheets, and published results.
- **Students** view their dashboard, fee status, open assessments, submitted work, and published results.

For assessment review, the app uses a demo role/user selector instead of a full login flow. This keeps the focus on the business workflows and lets reviewers quickly test both staff and student journeys.

## Tech Stack

- **Framework:** Next.js 16 App Router
- **Language:** TypeScript
- **UI:** React 19, Tailwind CSS, shared Shadcn-style components, Hugeicons, Sonner
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Workspace:** npm workspaces and Turborepo

## Business Logic Overview

The system is structured around realistic Registry operations:

- **Programmes and modules:** Staff can create and update academic programmes with a code, fee amount, duration, and child modules. Module deletion is blocked when assessments already depend on that module.
- **Student enrolment:** Staff enrol students into programmes. Each student receives a generated `SMS-YYYY-XXXX` student ID and an initial fee record based on the programme fee at the time of enrolment.
- **Fees and payments:** Each student has a fee record. Payments reduce the outstanding balance. Staff can extend due dates, apply discounts, record waivers, and make corrections. Overdue status is derived from due date plus outstanding balance.
- **Assessments:** Staff create assessments against modules. Assessments can be archived or restored. Deletion is only allowed when an assessment has no submissions.
- **Submissions:** Students browse open assessments for their programme and upload PDF/DOCX work. Archived assessments and inactive enrolments are blocked server-side.
- **Grading and publication:** Staff grade submissions and decide when results are published. Students only see published results.
- **Role-specific dashboards:** Staff see operational summaries and quick actions for common admin work. Students see fee status, open work, recent results, and quick links to common tasks.

Important data rules are enforced in API routes, not only in the UI. For example, a user cannot bypass the frontend to submit to an archived assessment, delete a module with assessments, or view unpublished results.

## Project Structure

```text
apps/web/
  app/             Next.js pages, layouts, loading states, and API routes
  components/      Dashboard, fee, result, student, layout, and feature UI
  lib/             Prisma client, API client, shared types, utilities
  prisma/          Prisma schema, migrations, and deterministic seed data
  public/uploads/  Uploaded submission files

packages/ui/
  src/components/  Shared Shadcn-style UI primitives
  src/styles/      Global Tailwind theme and CSS variables
```

## Run Locally

### Prerequisites

- Node.js 20+
- npm 11+
- PostgreSQL running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create the local database

Create a PostgreSQL database named `sms_tanvir_db`.

```bash
createdb sms_tanvir_db
```

If your local PostgreSQL user, password, host, port, or database name is different, update `DATABASE_URL` in `.env`.

### 3. Configure environment variables

Create a `.env` file in the project root. These are the local development values used for this assignment:

```env
DATABASE_URL="postgresql://postgres:1234@localhost:5432/sms_tanvir_db?schema=public"
NEXTAUTH_SECRET=""
NEXTAUTH_URL=""
NEXT_PUBLIC_APP_URL=""
```

Variable notes:

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | Prisma PostgreSQL connection string. Update the password/database name if your local setup differs. |
| `NEXTAUTH_SECRET` | No for this demo | Reserved for future authentication work. The current app uses a demo role/user selector. |
| `NEXTAUTH_URL` | No for this demo | Reserved for future authentication work. Can be left blank locally. |
| `NEXT_PUBLIC_APP_URL` | No for this demo | Reserved for absolute app URLs if needed later. Can be left blank locally. |

The repository also includes `.env.example` with a generic example connection string.

### 4. Run migrations and seed data

```bash
cd apps/web
npx prisma migrate dev
npx prisma db seed
cd ../..
```

On Windows PowerShell, if script execution policy blocks `npx`, use:

```powershell
cd apps/web
npx.cmd prisma migrate dev
npx.cmd prisma db seed
cd ../..
```

### 5. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If PowerShell blocks `npm`, use:

```powershell
npm.cmd run dev
```

## Demo Data

The seed creates staff users, student users, programmes, modules, fees, assessments, submissions, and grading data. The app uses the landing-page role selector, so reviewers do not need to type a password.

The seeded password source is:

```text
password123
```

Example seeded users:

| Name | Email | Role | Purpose |
|---|---|---|---|
| Dr Sarah Mitchell | `s.mitchell@college.ac.uk` | Staff | Registry staff user |
| Prof James Okafor | `j.okafor@college.ac.uk` | Staff | Registry staff user |
| Alice Nguyen | `alice.nguyen@student.ac.uk` | Student | Enrolled student with partial payment |
| Ben Carter | `ben.carter@student.ac.uk` | Student | Enrolled student with overdue balance |
| Fatima Al-Hassan | `fatima.alhassan@student.ac.uk` | Student | Fully paid student |
| Liam Brooks | `liam.brooks@student.ac.uk` | Student | Deferred student with overdue balance |
| Priya Sharma | `priya.sharma@student.ac.uk` | Student | Enrolled student with partial payment |

## Main Screens to Review

### Staff

- `/dashboard` - operational dashboard and quick actions
- `/dashboard/students` - searchable student registry, enrolment, and bulk updates
- `/dashboard/programmes` - programme and module management
- `/dashboard/fees` - fee overview, payments, adjustments, and overdue balances
- `/dashboard/assessments` - assessment creation, archive/restore/delete, and submission review
- `/dashboard/marksheet` - grading and publishing results

### Student

- `/dashboard` - student dashboard and fee status
- `/dashboard/assessments` - open assessment discovery and submission upload
- `/dashboard/results` - published results and printable marksheet
- `/dashboard/my-fees` - personal fee status and payment history

## Implementation Notes

- API routes follow a consistent `ApiResponse<T>` pattern using `{ data, error }`.
- Prisma owns the database schema, migrations, relationships, and deterministic seed data.
- Shared UI primitives live in `packages/ui`; feature-specific screens and components live in `apps/web`.
- Server routes enforce key business rules for destructive actions, submission eligibility, archived assessments, and result visibility.
- The UI includes responsive mobile layouts, empty states, confirmation dialogs, accessible button labels, table captions, keyboard-friendly interactions, and printable student marksheets.
- The role selector is intentionally simple for the assignment. It makes it easy to inspect the two user experiences without spending time on account provisioning.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

Web workspace only:

```bash
npm run lint -w web
npm run typecheck -w web
```

UI package only:

```bash
npm run lint -w @workspace/ui
npm run typecheck -w @workspace/ui
```

Prisma:

```bash
cd apps/web
npx prisma migrate dev
npx prisma db seed
npx prisma studio
```

## Database Documentation

See [database.md](database.md) for the schema explanation, relationships, table fields, enums, and design decisions.

## How I Used AI During the Build

I used AI as a pair-programming and review assistant, not as a replacement for engineering ownership.

This assignment had many connected requirements across the database, API layer, and role-specific UI. I used AI to help break large feature prompts into smaller implementation tasks, identify affected files, and trace how a change in one area should affect the rest of the system. That was useful for features such as assessment archiving, submission upload rules, fee adjustments, grading, and student-facing result visibility.

My workflow with AI was:

- explore the existing codebase first, then ask AI to help reason about the safest implementation path;
- draft API route and component changes in the style already used by the project;
- use AI to look for missed edge cases, especially around destructive actions and dependent records;
- review accessibility, mobile behaviour, empty states, confirmation dialogs, and loading/error states;
- run TypeScript, ESLint, Prisma migration, and seed checks, then use the errors to guide focused fixes.

I kept responsibility for the final business rules and implementation decisions. For example, assessment deletion is blocked when submissions exist, archived assessments are hidden from student submission flows, inactive students cannot submit work, modules with assessments cannot be deleted, and unpublished results remain hidden from students. Those rules are enforced server-side so the application does not rely only on frontend controls.

AI also helped improve polish that matters in a real product review: clearer dashboard quick actions, stronger contrast in shared UI components, responsive table/card layouts, reusable dialogs, consistent API responses, and README documentation for reviewers.

In short, I used AI in the right place: to move faster, audit the work more carefully, and improve consistency, while still owning the data model, business logic, user experience decisions, and verification.
