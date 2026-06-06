# Database Reference — SMS Registry Module

This document describes every table in the Student Management System schema: its purpose, all columns, constraints, and how it relates to other tables. Use this as the canonical reference when writing API routes, seed scripts, or migrations.

---

## Table of Contents

1. [users](#1-users)
2. [programmes](#2-programmes)
3. [students](#3-students)
4. [fees](#4-fees)
5. [payments](#5-payments)
6. [modules](#6-modules)
7. [assessments](#7-assessments)
8. [submissions](#8-submissions)
9. [results](#9-results)
10. [Enums](#10-enums)
11. [Relationship Summary](#11-relationship-summary)
12. [Key Design Decisions](#12-key-design-decisions)

---

## 1. `users`

**Purpose:** The single authentication and identity table for everyone in the system. Both staff and students have a row here. The `role` field determines which views and actions are available. A `Student` profile is created separately and linked via `user_id` after registration.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `full_name` | `text` | NOT NULL | Display name used across the UI |
| `email` | `text` | NOT NULL, UNIQUE | Login credential and contact address |
| `password_hash` | `text` | NOT NULL | Bcrypt hash; raw password never stored |
| `role` | `Role` | NOT NULL, DEFAULT `STUDENT` | `STAFF` or `STUDENT` — drives access control |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | Row creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL | Auto-updated on every write |

**Relations:**

- `users` → `students` (one-to-one, optional): a user with role `STUDENT` will have one linked `students` row.
- `users` → `assessments` (one-to-many): a user with role `STAFF` can create many assessments.

**Notes:**
- Deleting a `User` cascades to their `Student` profile and all downstream records.
- For the role-toggle approach described in the brief, `role` can be switched without creating a new user account.

---

## 2. `programmes`

**Purpose:** Represents an academic programme (e.g. BSc Computer Science, MBA). Defines the standard fee charged to all students enrolled on it and acts as the top-level grouping for modules.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `name` | `text` | NOT NULL | Full name, e.g. "BSc Computer Science" |
| `code` | `text` | NOT NULL, UNIQUE | Short code, e.g. `BSC-CS` |
| `fee_amount` | `decimal(10,2)` | NOT NULL | Base fee assigned to every student on enrolment |
| `duration_years` | `int` | NOT NULL | Expected programme length in years |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | — |
| `updated_at` | `timestamptz` | NOT NULL | — |

**Relations:**

- `programmes` → `students` (one-to-many): a programme has many enrolled students.
- `programmes` → `modules` (one-to-many): a programme is broken into one or more modules.

**Notes:**
- `fee_amount` is the *template* fee. When a student is enrolled, a `fees` row is created with `total_amount` copied from this value. Changing `fee_amount` here does not retroactively affect existing student fee records.

---

## 3. `students`

**Purpose:** The Registry's academic profile for a student. Extends `users` with programme membership, academic year, enrolment status, and the human-readable Student ID. This is the central entity for Registry workflows — nearly every other table links back to it.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `user_id` | `uuid` | FK → `users.id`, UNIQUE, NOT NULL | Links to the auth/identity record |
| `programme_id` | `uuid` | FK → `programmes.id`, NOT NULL | The programme the student is enrolled on |
| `student_id` | `text` | UNIQUE, NOT NULL | Human-readable ID, format `SMS-YYYY-XXXX` |
| `academic_year` | `int` | NOT NULL | Current year of study, e.g. `1`, `2`, `3` |
| `status` | `EnrolmentStatus` | NOT NULL, DEFAULT `ENROLLED` | `ENROLLED`, `DEFERRED`, `WITHDRAWN`, or `COMPLETED` |
| `date_of_birth` | `date` | NOT NULL | Used for identity verification |
| `enrolled_at` | `timestamptz` | NOT NULL, DEFAULT now() | When the student was added to the system |
| `updated_at` | `timestamptz` | NOT NULL | — |

**Relations:**

- `students` → `users` (many-to-one): every student belongs to one user account.
- `students` → `programmes` (many-to-one): every student is enrolled on one programme.
- `students` → `fees` (one-to-one, optional): one fee record exists per student.
- `students` → `submissions` (one-to-many): a student can have many submissions.
- `students` → `results` (one-to-many): a student can have many results.

**Notes:**
- `student_id` generation: take the current year and the count of existing students + 1, formatted as `SMS-{YEAR}-{COUNT padded to 4 digits}`. Implement this in a Prisma `$transaction` to avoid race conditions.
- When `status` changes to `WITHDRAWN` or `COMPLETED`, downstream workflows (late fees, open submissions) should be handled at the application layer.

---

## 4. `fees`

**Purpose:** Tracks the fee obligation for a single student. There is exactly one fee record per student, created at enrolment with `total_amount` copied from the programme's `fee_amount`. Every payment made against this record reduces `outstanding`. The `is_overdue` flag is used by the Registry dashboard to surface students with unpaid balances past their due date.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `student_id` | `uuid` | FK → `students.id`, UNIQUE, NOT NULL | The student this fee belongs to |
| `total_amount` | `decimal(10,2)` | NOT NULL | Total amount owed (copied from programme at enrolment) |
| `amount_paid` | `decimal(10,2)` | NOT NULL, DEFAULT `0.00` | Running total of all payments received |
| `outstanding` | `decimal(10,2)` | NOT NULL | `total_amount - amount_paid`; updated on each payment |
| `due_date` | `date` | NOT NULL | Deadline for full payment |
| `is_overdue` | `boolean` | NOT NULL, DEFAULT `false` | Set to `true` when `due_date < today` AND `outstanding > 0` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | — |
| `updated_at` | `timestamptz` | NOT NULL | — |

**Relations:**

- `fees` → `students` (many-to-one): each fee record belongs to one student.
- `fees` → `payments` (one-to-many): a fee record can have many payment transactions against it.

**Notes:**
- `outstanding` and `amount_paid` are stored explicitly (not computed on the fly) to keep dashboard queries fast. Update both fields atomically inside a `$transaction` when recording a payment.
- `is_overdue` should be recalculated on every fee read, or updated by a scheduled job (e.g. a daily cron that runs `UPDATE fees SET is_overdue = true WHERE due_date < NOW() AND outstanding > 0`).

---

## 5. `payments`

**Purpose:** An immutable log of individual payment transactions. Each row represents a single payment event recorded by a Registry administrator — the amount, date, and a reference number (bank transfer ref, receipt ID, etc.). Payments are never edited or deleted; mistakes are corrected by recording a new adjustment payment.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `fee_id` | `uuid` | FK → `fees.id`, NOT NULL | The fee record this payment reduces |
| `amount` | `decimal(10,2)` | NOT NULL | Amount paid in this transaction |
| `payment_date` | `date` | NOT NULL | Date the payment was received (may differ from `created_at`) |
| `reference_number` | `text` | NOT NULL | External reference from the payer's bank or receipt system |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | When this record was entered into the system |

**Relations:**

- `payments` → `fees` (many-to-one): many payment transactions roll up to one fee record.

**Notes:**
- Deleting a `Fee` cascades to all its payment rows.
- `reference_number` is not enforced as unique at the DB level because different banks may reuse reference formats. Uniqueness should be validated at the application layer if required.

---

## 6. `modules`

**Purpose:** A unit of study within a programme. Modules are the direct parent of assessments — staff create assessments under a specific module, giving the grading system subject-level granularity. A programme has many modules; a module belongs to exactly one programme.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `programme_id` | `uuid` | FK → `programmes.id`, NOT NULL | The programme this module belongs to |
| `title` | `text` | NOT NULL | Full title, e.g. "Introduction to Algorithms" |
| `code` | `text` | NOT NULL, UNIQUE | Short code, e.g. `CS101` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | — |
| `updated_at` | `timestamptz` | NOT NULL | — |

**Relations:**

- `modules` → `programmes` (many-to-one): each module belongs to one programme.
- `modules` → `assessments` (one-to-many): a module can have many assessments.

---

## 7. `assessments`

**Purpose:** A graded task (coursework, exam, project) created by a staff member for a module. Defines the submission deadline — any `Submission` recorded after this timestamp is flagged `is_late`. An assessment remains open for submissions until its deadline passes; staff can still accept and grade late work afterwards.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `module_id` | `uuid` | FK → `modules.id`, NOT NULL | The module this assessment belongs to |
| `created_by` | `uuid` | FK → `users.id`, NOT NULL | The staff member who created the assessment |
| `title` | `text` | NOT NULL | e.g. "Final Project — Database Design" |
| `deadline` | `timestamptz` | NOT NULL | Submission deadline; determines `is_late` on submissions |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | — |
| `updated_at` | `timestamptz` | NOT NULL | — |

**Relations:**

- `assessments` → `modules` (many-to-one): each assessment belongs to one module.
- `assessments` → `users` (many-to-one): each assessment was created by one staff user.
- `assessments` → `submissions` (one-to-many): students submit work against this assessment.
- `assessments` → `results` (one-to-many): grades are entered per student per assessment.

---

## 8. `submissions`

**Purpose:** Records a student's uploaded file for a specific assessment. The unique constraint on `(assessment_id, student_id)` enforces the one-submission-per-student-per-assessment rule. Re-submissions before the deadline are handled by updating the existing row (`file_url`, `file_type`, `submitted_at`, `is_late`). `is_late` is determined at the moment of upload and frozen — it is not recalculated if the deadline is later edited.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `assessment_id` | `uuid` | FK → `assessments.id`, NOT NULL | The assessment this work is submitted for |
| `student_id` | `uuid` | FK → `students.id`, NOT NULL | The student submitting |
| `file_url` | `text` | NOT NULL | Storage path or URL to the uploaded file |
| `file_type` | `FileType` | NOT NULL | `PDF` or `DOCX` |
| `submitted_at` | `timestamptz` | NOT NULL, DEFAULT now() | Timestamp of upload; compared to `assessment.deadline` |
| `is_late` | `boolean` | NOT NULL, DEFAULT `false` | `true` if `submitted_at > assessment.deadline` at time of upload |
| `updated_at` | `timestamptz` | NOT NULL | Updated on re-submission |

**Unique constraint:** `(assessment_id, student_id)` — one submission per student per assessment.

**Relations:**

- `submissions` → `assessments` (many-to-one): each submission belongs to one assessment.
- `submissions` → `students` (many-to-one): each submission belongs to one student.
- `submissions` → `results` (one-to-one, optional): a submission may have one graded result.

**Notes:**
- Re-submission logic: use `upsert` on the `(assessment_id, student_id)` constraint. Accept re-submissions only if `now() < assessment.deadline`; reject at the API layer otherwise (unless staff override is needed).
- File storage: `file_url` should point to a cloud storage bucket (e.g. S3, Supabase Storage). The database stores only the reference, not the binary.

---

## 9. `results`

**Purpose:** The grade record for a student on a specific assessment. Created by staff after a submission exists. `is_published` controls whether the student can see their grade — staff enter and save grades privately, then publish them explicitly. `student_id` and `assessment_id` are stored directly alongside `submission_id` to allow efficient marksheet queries without always joining through `submissions`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Auto-generated primary key |
| `submission_id` | `uuid` | FK → `submissions.id`, UNIQUE, NOT NULL | The submission this result grades |
| `student_id` | `uuid` | FK → `students.id`, NOT NULL | Denormalised for fast marksheet queries |
| `assessment_id` | `uuid` | FK → `assessments.id`, NOT NULL | Denormalised for fast marksheet queries |
| `grade` | `int` | NOT NULL | Numeric grade, 0–100 |
| `classification` | `Classification` | NOT NULL | Derived at write time from `grade` (see below) |
| `is_published` | `boolean` | NOT NULL, DEFAULT `false` | `false` = only staff can see; `true` = student can see |
| `graded_at` | `timestamptz` | NOT NULL, DEFAULT now() | When the grade was first entered |
| `updated_at` | `timestamptz` | NOT NULL | Updated on any grade revision |

**Classification rules (applied at write time):**

| Grade range | Classification |
|---|---|
| 0 – 39 | `FAIL` |
| 40 – 59 | `PASS` |
| 60 – 69 | `MERIT` |
| 70 – 100 | `DISTINCTION` |

**Relations:**

- `results` → `submissions` (one-to-one): each result grades exactly one submission.
- `results` → `students` (many-to-one): a student can have many results across assessments.
- `results` → `assessments` (many-to-one): an assessment can have many results (one per student).

**Notes:**
- `student_id` and `assessment_id` are intentional denormalization. They are always consistent with `submission.student_id` and `submission.assessment_id` — enforce this at the API layer when creating a result.
- When a student queries their marksheet, filter by `student_id = <id> AND is_published = true`.
- Staff can query `assessment_id = <id>` to get all grades for a full marksheet view regardless of publish status.

---

## 10. Enums

### `Role`
| Value | Meaning |
|---|---|
| `STAFF` | Registry administrator or academic staff; full write access |
| `STUDENT` | Enrolled student; read-only on own records |

### `EnrolmentStatus`
| Value | Meaning |
|---|---|
| `ENROLLED` | Currently active |
| `DEFERRED` | Temporarily paused — not attending but not withdrawn |
| `WITHDRAWN` | Permanently left the programme |
| `COMPLETED` | Finished all requirements |

### `Classification`
| Value | Grade range |
|---|---|
| `FAIL` | 0–39 |
| `PASS` | 40–59 |
| `MERIT` | 60–69 |
| `DISTINCTION` | 70–100 |

### `FileType`
| Value | Meaning |
|---|---|
| `PDF` | Portable Document Format |
| `DOCX` | Microsoft Word Open XML |

---

## 11. Relationship Summary

```
users ──────────────────── students          (1:1 — one student profile per user)
users ──────────────────── assessments       (1:N — staff user creates many assessments)

programmes ─────────────── students          (1:N — programme has many students)
programmes ─────────────── modules           (1:N — programme has many modules)

students ───────────────── fees              (1:1 — one fee record per student)
students ───────────────── submissions       (1:N — student makes many submissions)
students ───────────────── results           (1:N — student receives many results)

fees ───────────────────── payments          (1:N — fee record has many payment transactions)

modules ────────────────── assessments       (1:N — module has many assessments)

assessments ────────────── submissions       (1:N — assessment receives many submissions)
assessments ────────────── results           (1:N — assessment generates many results)

submissions ────────────── results           (1:1 — one result per submission)
```

---

## 12. Key Design Decisions

**Why is `outstanding` stored on `fees` rather than computed?**
Dashboard queries for overdue students would require summing all payment rows on every render. Storing `outstanding` explicitly and updating it atomically on each payment write keeps the dashboard query simple and fast. The trade-off is that `amount_paid + outstanding` must always equal `total_amount` — enforce this in a Prisma `$transaction`.

**Why does `Result` repeat `student_id` and `assessment_id`?**
The marksheet is one of the most-read views in the system. Storing both FKs directly on `Result` avoids a join through `Submission` on every marksheet load. These fields are denormalized by design and must be kept consistent with the parent `Submission` at write time.

**Why is `is_late` frozen at submission time?**
If a staff member edits an assessment's deadline after students have already submitted, retroactively recalculating `is_late` would change historical records. The flag captures the factual state at the moment of upload.

**Why is `Fee` 1:1 with `Student` rather than 1:N?**
Each student has one fee obligation per enrolment. Multiple fee periods (e.g. per academic year) could be modelled with 1:N in future, but for this scope a single record with a running `amount_paid` balance is sufficient and simpler to display.

**Why is `Module` a separate entity rather than a field on `Assessment`?**
Assessments need to be grouped by subject area for the marksheet view and for filtering. If `module` were just a text field, grouping would be unreliable. A proper `Module` entity allows a clean join and enables future extensions (e.g. module-level pass rates, per-module fee components).
