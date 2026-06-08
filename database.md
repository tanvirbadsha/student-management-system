# Database Schema

## Overview

The Student Management System schema is centred on users, student registry records, academic programmes, modules, assessments, submissions, results, and fee management. `User` stores identity and role information, `Student` extends a user with academic registry data, `Programme` and `Module` model the curriculum structure, and assessment workflows connect `Assessment`, `Submission`, and `Result`. Fee workflows are kept separate through `Fee`, `Payment`, and `FeeAdjustment` so Registry staff can track balances, due dates, payments, waivers, and corrections without changing academic records.

## Entity Relationship Summary

```text
User 1 ── 0..1 Student
Student * ── 1 Programme
Student 1 ── 0..1 Fee
Fee 1 ── * Payment
Fee 1 ── * FeeAdjustment
Programme 1 ── * Module
Module 1 ── * Assessment
Assessment 1 ── * Submission
Submission 1 ── 0..1 Result
Student 1 ── * StudentNote
Student 1 ── * Submission
Student 1 ── * Result
Assessment 1 ── * Result
User 1 ── * Assessment created by staff
User 1 ── * StudentNote authored by staff
User 1 ── * FeeAdjustment applied by staff
```

## Tables

### User

Stores authentication identity and role information for staff and students.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| fullName | String | User display name. | Required, maps to `full_name` |
| email | String | Login/contact email. | Required, unique |
| passwordHash | String | Hashed password. | Required, maps to `password_hash` |
| role | Role | Access role for dashboard branching. | Required, default STUDENT |
| createdAt | DateTime | Creation timestamp. | Default now(), maps to `created_at` |
| updatedAt | DateTime | Last update timestamp. | `@updatedAt`, maps to `updated_at` |

### Programme

Represents an academic programme and defines the template fee and duration used for new enrolments.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| name | String | Programme name. | Required |
| code | String | Human-readable programme code. | Required, unique |
| feeAmount | Decimal | Base fee copied into new student fee records. | Decimal(10,2), maps to `fee_amount` |
| durationYears | Int | Expected programme length. | Required, maps to `duration_years` |
| createdAt | DateTime | Creation timestamp. | Default now(), maps to `created_at` |
| updatedAt | DateTime | Last update timestamp. | `@updatedAt`, maps to `updated_at` |

### Student

Extends a `User` with registry and academic enrolment information.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| userId | String | Linked user account. | Required, unique, maps to `user_id`, cascade delete |
| programmeId | String | Current programme. | Required, maps to `programme_id` |
| studentId | String | Public student identifier such as SMS-2025-0001. | Required, unique, maps to `student_id` |
| academicYear | Int | Current academic year. | Required, maps to `academic_year` |
| status | EnrolmentStatus | Enrolment lifecycle state. | Required, default ENROLLED |
| dateOfBirth | DateTime | Student date of birth. | Required date, maps to `date_of_birth` |
| enrolledAt | DateTime | Enrolment timestamp. | Default now(), maps to `enrolled_at` |
| withdrawalDate | DateTime? | Date withdrawn, when applicable. | Optional, maps to `withdrawal_date` |
| updatedAt | DateTime | Last update timestamp. | `@updatedAt`, maps to `updated_at` |

### StudentNote

Stores staff-authored registry notes against a student.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal cuid primary key. | Primary key, default cuid() |
| studentId | String | Student being annotated. | Required, maps to `student_id`, cascade delete |
| authorId | String | Staff user who wrote the note. | Required, maps to `author_id` |
| content | String | Note body. | Required text |
| createdAt | DateTime | Creation timestamp. | Default now(), maps to `created_at` |

### Fee

Represents a student's fee balance and payment deadline.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| studentId | String | Student owning the fee record. | Required, unique, maps to `student_id`, cascade delete |
| totalAmount | Decimal | Total charged amount. | Decimal(10,2), maps to `total_amount` |
| amountPaid | Decimal | Sum of recorded payments. | Decimal(10,2), default 0, maps to `amount_paid` |
| outstanding | Decimal | Remaining balance. | Decimal(10,2) |
| dueDate | DateTime | Payment due date. | Required date, maps to `due_date` |
| isOverdue | Boolean | Whether due date has passed with balance outstanding. | Default false, maps to `is_overdue` |
| isWaived | Boolean | Whether outstanding balance has been waived. | Default false, maps to `is_waived` |
| createdAt | DateTime | Creation timestamp. | Default now(), maps to `created_at` |
| updatedAt | DateTime | Last update timestamp. | `@updatedAt`, maps to `updated_at` |

### FeeAdjustment

Stores scholarships, waivers, and correction history for fee changes.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal cuid primary key. | Primary key, default cuid() |
| feeId | String | Fee being adjusted. | Required, maps to `fee_id`, cascade delete |
| adjustmentType | String | DISCOUNT, WAIVER, or CORRECTION. | Required, maps to `adjustment_type` |
| amount | Decimal? | Adjustment amount when applicable. | Optional Decimal(10,2) |
| reason | String | Staff-entered explanation. | Required text |
| appliedById | String | Staff user who applied adjustment. | Required, maps to `applied_by_id` |
| createdAt | DateTime | Creation timestamp. | Default now(), maps to `created_at` |

### Payment

Stores individual payment transactions against a fee.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| feeId | String | Fee receiving the payment. | Required, maps to `fee_id`, cascade delete |
| amount | Decimal | Payment amount. | Decimal(10,2) |
| paymentDate | DateTime | Date payment was made. | Required date, maps to `payment_date` |
| referenceNumber | String | Bank/receipt reference. | Required, maps to `reference_number` |
| createdAt | DateTime | Creation timestamp. | Default now(), maps to `created_at` |

### Module

Represents a unit of study within a programme.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| programmeId | String | Owning programme. | Required, maps to `programme_id` |
| title | String | Module title. | Required |
| code | String | Human-readable module code. | Required, unique |
| createdAt | DateTime | Creation timestamp. | Default now(), maps to `created_at` |
| updatedAt | DateTime | Last update timestamp. | `@updatedAt`, maps to `updated_at` |

### Assessment

Stores coursework/assessment tasks created by staff for a module.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| moduleId | String | Module being assessed. | Required, maps to `module_id` |
| createdById | String | Staff user who created the assessment. | Required, maps to `created_by` |
| title | String | Assessment title. | Required |
| deadline | DateTime | Submission deadline. | Required |
| isArchived | Boolean | Hides assessment from student submission workflows. | Default false, maps to `is_archived` |
| createdAt | DateTime | Creation timestamp. | Default now(), maps to `created_at` |
| updatedAt | DateTime | Last update timestamp. | `@updatedAt`, maps to `updated_at` |

### Submission

Stores one uploaded file per student per assessment.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| assessmentId | String | Submitted assessment. | Required, maps to `assessment_id` |
| studentId | String | Submitting student. | Required, maps to `student_id`, cascade delete |
| fileUrl | String | Public upload URL. | Required, maps to `file_url` |
| fileType | FileType | Uploaded file type. | Required, maps to `file_type` |
| submittedAt | DateTime | Submission timestamp. | Default now(), maps to `submitted_at` |
| isLate | Boolean | Late flag captured at upload time. | Default false, maps to `is_late` |
| updatedAt | DateTime | Last update timestamp. | `@updatedAt`, maps to `updated_at` |

Constraint: `(assessmentId, studentId)` is unique so a student has at most one active submission per assessment.

### Result

Stores grading and publication state for a submission.

| Field | Type | Description | Constraints |
|---|---|---|---|
| id | String | Internal UUID primary key. | Primary key, default uuid() |
| submissionId | String | Submission being graded. | Required, unique, maps to `submission_id`, cascade delete |
| studentId | String | Denormalised student reference for marksheet queries. | Required, maps to `student_id` |
| assessmentId | String | Denormalised assessment reference for marksheet queries. | Required, maps to `assessment_id` |
| grade | Int | Numeric grade from 0 to 100. | Required |
| classification | Classification | Derived classification. | Required |
| isPublished | Boolean | Whether the student can see the result. | Default false, maps to `is_published` |
| gradedAt | DateTime | Initial grading timestamp. | Default now(), maps to `graded_at` |
| updatedAt | DateTime | Last update timestamp. | `@updatedAt`, maps to `updated_at` |

## Enums

### Role

| Value | Meaning |
|---|---|
| STAFF | Registry/staff user with management access. |
| STUDENT | Student user with self-service access. |

### EnrolmentStatus

| Value | Meaning |
|---|---|
| ENROLLED | Active student. |
| DEFERRED | Student has deferred study. |
| WITHDRAWN | Student has withdrawn. |
| COMPLETED | Student completed the programme. |

### Classification

| Value | Meaning |
|---|---|
| FAIL | Grade below 40. |
| PASS | Grade from 40 to 59. |
| MERIT | Grade from 60 to 69. |
| DISTINCTION | Grade 70 or above. |

### FileType

| Value | Meaning |
|---|---|
| PDF | PDF submission file. |
| DOCX | Microsoft Word DOCX submission file. |

## Design Decisions

- `studentId` is separate from the UUID primary key so Registry can display stable, human-readable IDs while preserving opaque internal identifiers for relations.
- `Fee.outstanding` is stored rather than always derived so list screens and overdue checks can query balances efficiently; API mutations keep it in sync with payments and adjustments.
- `Result` is separate from `Submission` because a submission can exist before grading, and publication state belongs to assessment outcomes rather than upload metadata.
- `Submission.isLate` is captured at upload time and not recalculated when deadlines change, preserving the original submission context for auditability.
