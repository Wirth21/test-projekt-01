# PROJ-5: Admin-Bereich

## Status: In Review
**Created:** 2026-03-13
**Last Updated:** 2026-03-16

## Dependencies
- Requires: PROJ-1 (User Authentication) — Admin-Rolle ist an Nutzerkonten geknüpft; Registrierungs-Flow wird erweitert
- Requires: PROJ-2 (Projektverwaltung) — Admin verwaltet Projektzugriffe

## Overview
Ein globaler Administrator hat Zugriff auf einen separaten Admin-Bereich der App. Dort kann er:
1. Neue Nutzer-Registrierungen freigeben oder ablehnen (Nutzer sind nach Registrierung zunächst gesperrt)
2. Eine Übersicht aller Nutzer und deren Projektzugriffe sehen
3. Projektzugriffe von Nutzern verwalten (hinzufügen / entfernen)
4. Nutzer-Accounts deaktivieren oder löschen

Die Admin-Rolle ist systemweit und wird direkt in der Datenbank gesetzt (kein Self-Service).

## User Stories
- Als Admin möchte ich eine Liste aller ausstehenden Registrierungsanfragen sehen, damit ich neue Nutzer freigeben oder ablehnen kann.
- Als Admin möchte ich einen neu registrierten Nutzer freigeben, damit dieser sich einloggen und die App nutzen kann.
- Als Admin möchte ich eine Registrierung ablehnen (mit optionaler Begründung), damit unerwünschte Nutzer keinen Zugang erhalten.
- Als Admin möchte ich eine Übersicht aller aktiven Nutzer sehen (Name, E-Mail, Status, Registrierungsdatum).
- Als Admin möchte ich für jeden Nutzer sehen, auf welche Projekte er Zugriff hat.
- Als Admin möchte ich einen Nutzer zu einem Projekt hinzufügen oder aus einem Projekt entfernen.
- Als Admin möchte ich einen Nutzer-Account deaktivieren, damit er sich nicht mehr einloggen kann (ohne die Daten zu löschen).
- Als Admin möchte ich einen Nutzer-Account dauerhaft löschen, damit alle seine Daten entfernt werden.
- Als nicht-Admin-Nutzer darf ich keinen Zugriff auf den Admin-Bereich haben.

## Acceptance Criteria

### Allgemein
- [ ] Admin-Bereich ist nur für Nutzer mit Admin-Rolle zugänglich (Route `/admin`)
- [ ] Nicht-Admin-Nutzer, die `/admin` aufrufen, werden zur Hauptseite weitergeleitet
- [ ] Admin-Rolle wird über ein `is_admin`-Flag in der Datenbank gesteuert

### Registrierungs-Freigaben
- [ ] Nach einer Registrierung ist der Nutzer-Account im Status "Ausstehend" (pending) und kann sich nicht einloggen
- [ ] Admin sieht im Bereich "Freigaben" eine Liste aller ausstehenden Anfragen mit: Name, E-Mail, Registrierungsdatum
- [ ] Admin kann eine Anfrage mit einem Klick freigeben → Nutzer erhält Benachrichtigungs-E-Mail und kann sich einloggen
- [ ] Admin kann eine Anfrage ablehnen → Nutzer wird informiert, Account wird gelöscht
- [ ] Freigegebene Nutzer verschwinden aus der "Ausstehend"-Liste und erscheinen in der Nutzerliste

### Nutzerverwaltung
- [ ] Admin sieht eine Tabelle aller Nutzer: Name, E-Mail, Status (Aktiv / Deaktiviert), Registrierungsdatum, Anzahl Projekte
- [ ] Admin kann die Nutzerliste nach Name/E-Mail filtern/suchen
- [ ] Klick auf einen Nutzer öffnet eine Detailansicht mit allen Projekten, auf die dieser Nutzer Zugriff hat
- [ ] Admin kann einen Nutzer deaktivieren → Nutzer kann sich nicht mehr einloggen, Daten bleiben erhalten
- [ ] Admin kann einen deaktivierten Nutzer reaktivieren
- [ ] Admin kann einen Nutzer dauerhaft löschen (mit zweistufigem Bestätigungsdialog)
- [ ] Der eigene Admin-Account kann nicht deaktiviert oder gelöscht werden

### Projektzugriffs-Verwaltung
- [ ] In der Nutzer-Detailansicht: Liste aller Projekte mit Zugriff (Projektname, Rolle: Mitglied / Ersteller)
- [ ] Admin kann einen Nutzer zu einem bestehenden Projekt hinzufügen (Dropdown mit allen Projekten)
- [ ] Admin kann einen Nutzer aus einem Projekt entfernen (auch wenn er Ersteller ist — mit Warnung)
- [ ] Alternativ: In einer Projektansicht kann Admin alle Mitglieder eines Projekts verwalten

## Edge Cases
- Was passiert wenn ein Nutzer versucht sich einzuloggen, der noch "ausstehend" ist? → Fehlermeldung: "Dein Account wartet noch auf Freigabe durch einen Administrator."
- Was passiert wenn ein Nutzer versucht sich einzuloggen, der deaktiviert wurde? → Fehlermeldung: "Dein Account wurde deaktiviert. Kontaktiere den Administrator."
- Was passiert wenn der letzte Admin gelöscht oder deaktiviert wird? → Nicht möglich: Löschen/Deaktivieren des eigenen Admin-Accounts wird verhindert
- Was passiert wenn ein gelöschter Nutzer als Ersteller eines Projekts eingetragen ist? → Projekt bleibt bestehen, Ersteller-Feld zeigt "Gelöschter Nutzer"; Admin kann neuen Ersteller zuweisen
- Was passiert wenn ein deaktivierter Nutzer bereits in Projekten Mitglied ist? → Mitgliedschaft bleibt erhalten, Nutzer hat nur keinen Login-Zugriff mehr
- Was passiert wenn man versucht `/admin` ohne Admin-Rechte aufzurufen? → Sofortige Weiterleitung zur Hauptseite, keine Fehlermeldung (Security through obscurity)

## Technical Requirements
- `is_admin: boolean` Spalte in der `users`/`profiles` Tabelle (Standard: false)
- `status: enum('pending', 'active', 'disabled')` Spalte in der `profiles` Tabelle
- RLS: Admin-Tabellen-Zugriff nur für Nutzer mit `is_admin = true`
- E-Mail-Benachrichtigungen: Freigabe-/Ablehnungs-Mail via Supabase Auth oder Edge Function
- Admin-Route ist server-seitig geschützt (Middleware prüft Admin-Rolle)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## Implementation Notes (Backend)

**Gebaut am:** 2026-03-16

### Design Decisions (Based on User Input)
1. **Admin Seed:** `f.stoeckel@wirth-chemnitz.de` is seeded as admin via SQL migration
2. **User Status:** Status column (`pending`/`active`/`disabled`/`deleted`) in profiles table; middleware blocks access for non-active users
3. **Email Notifications:** None -- no email notifications for approval/rejection
4. **User Deletion:** Soft delete only (mark as `deleted` in profiles); no `auth.users` deletion

### Database Migration
- **`supabase/migrations/004_admin_panel.sql`** -- Full migration:
  - Added `is_admin BOOLEAN NOT NULL DEFAULT false` to profiles
  - Added `status TEXT NOT NULL DEFAULT 'pending'` with CHECK constraint (`pending`, `active`, `disabled`, `deleted`)
  - Indexes on `status` and `is_admin`
  - Updated RLS: admins can see all profiles; regular users only see active profiles + own
  - Admin-specific RLS policies on `projects` and `project_members` (admin can view/manage all)
  - Updated `handle_new_user()` trigger to set `status = 'pending'` and fixed SECURITY DEFINER search_path (PROJ-1 BUG-9)
  - Seeded `f.stoeckel@wirth-chemnitz.de` as admin with active status
  - Set all existing users to `active` status (pre-migration users are not locked out)
  - Helper function `public.is_admin()` for reuse

### API Routes Created
- **`GET /api/admin/users`** -- List all users (admin only), supports `?search=` and `?status=` query params, includes project count per user
- **`PUT /api/admin/users/[userId]/status`** -- Change user status (active/disabled/deleted), prevents self-deactivation/deletion
- **`GET /api/admin/users/[userId]/projects`** -- List user's project memberships with project names (Supabase join, no N+1)
- **`POST /api/admin/users/[userId]/projects`** -- Add user to a project (with existence and duplicate checks)
- **`DELETE /api/admin/users/[userId]/projects`** -- Remove user from a project
- **`GET /api/admin/pending`** -- List all pending registrations
- **`POST /api/admin/pending`** -- Approve a pending user (sets status to `active`)
- **`DELETE /api/admin/pending`** -- Reject a pending user (sets status to `deleted`, soft delete)
- **`GET /api/admin/projects`** -- List all non-archived projects (for admin dropdown)

### Middleware Updates
- **`middleware.ts`** -- Extended to:
  - Check profile `status` for authenticated users on protected routes
  - Pending users: sign out + redirect to `/login?error=pending`
  - Disabled/deleted users: sign out + redirect to `/login?error=disabled`
  - Admin route protection: non-admins on `/admin/*` redirected to `/dashboard`
  - API routes excluded from status check (APIs have their own auth)

### Frontend Updates
- **`src/app/login/page.tsx`** -- Wrapped LoginForm in Suspense boundary for useSearchParams
- **`src/components/auth/LoginForm.tsx`** -- Reads `?error=pending` and `?error=disabled` query params to show status-specific messages

### Validation Schemas
- **`src/lib/validations/admin.ts`** -- Zod schemas for all admin API inputs:
  - `approveUserSchema`, `rejectUserSchema` (userId as UUID)
  - `updateUserStatusSchema` (userId + status enum)
  - `addUserToProjectSchema`, `removeUserFromProjectSchema` (userId + projectId)

### Types
- **`src/lib/types/admin.ts`** -- TypeScript types: `AdminProfile`, `AdminProfileWithProjects`, `AdminUserProject`, `PendingUser`, `UserStatus`

### Utilities
- **`src/lib/admin.ts`** -- `getAuthenticatedAdmin()` helper for server-side admin verification (used by all admin API routes)

### Security
- All admin API routes verify admin status via `getAuthenticatedAdmin()` before processing
- All POST/PUT/DELETE inputs validated with Zod schemas
- Self-deactivation/deletion prevented at API level
- RLS policies enforce admin-only access at database level (defense in depth)
- Non-admin users accessing `/admin` are silently redirected (no error message)

### Build Status
- `npm run build` passes with no errors (Next.js 16.1.6 Turbopack)

### Frontend Implementation (2026-03-17)

**Pages:**
- **`/admin`** (default tab) -- Pending approvals page with approve/reject actions and confirmation dialogs
- **`/admin/users`** -- User management table with search, status filter, click-to-open detail sheet

**Layout:**
- **`/admin/layout.tsx`** -- Top tabs navigation (Freigaben, Nutzerverwaltung) with back arrow to dashboard
- Same visual style as existing dashboard (max-w-6xl, sticky header, bg-background)

**Components:**
- **`src/components/admin/UserDetailSheet.tsx`** -- Sliding panel (shadcn Sheet) showing:
  - User info (name, email, status badge, registration date, project count)
  - Status actions (deactivate, reactivate, delete) with confirmation dialogs
  - Self-protection: cannot deactivate/delete own admin account
  - Project access management: list of current projects, add-to-project dropdown, remove from project
  - Owner removal warning when removing project creator

**Hooks:**
- **`src/hooks/use-admin.ts`** -- Data fetching hooks:
  - `usePendingUsers()` -- fetch/approve/reject pending registrations
  - `useAdminUsers(search, statusFilter)` -- fetch users with debounced search + status filter
  - `useUserProjects(userId)` -- fetch/add/remove user project memberships
  - `useAdminProjects()` -- fetch all projects for add-to-project dropdown

**Dashboard Integration:**
- **`src/app/(protected)/dashboard/page.tsx`** -- Admin link (shield icon + "Admin" button) in dashboard header, visible only for users with `is_admin = true`

**States implemented:** Loading (skeletons), error (retry button), empty (icon + message) for all views

**Build Status:** `npm run build` passes with no errors

## QA Test Results

**Tested:** 2026-03-17
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Allgemein — Admin-Bereich nur fuer Admin-Rolle zugaenglich (Route /admin)
- [x] Middleware checks `is_admin` flag on profile for `/admin` routes (middleware.ts line 88)
- [x] Non-admin users redirected to `/dashboard` (silent redirect, no error message)
- [x] Admin route is `/admin` as specified
- **PASS**

#### AC-2: Nicht-Admin-Nutzer auf /admin werden zur Hauptseite weitergeleitet
- [x] Middleware redirects non-admins to `/dashboard` (middleware.ts line 89-91)
- [x] No error message shown (security through obscurity as specified)
- **PASS**

#### AC-3: Admin-Rolle ueber is_admin-Flag in Datenbank gesteuert
- [x] `is_admin BOOLEAN NOT NULL DEFAULT false` column added (migration line 11)
- [x] Index on `is_admin` created (migration line 22)
- [x] API routes verify via `getAuthenticatedAdmin()` which reads `is_admin` from profiles
- **PASS**

#### AC-4: Nach Registrierung ist Account im Status "pending" — kann sich nicht einloggen
- [x] `handle_new_user()` trigger sets `status = 'pending'` (migration line 154)
- [x] Middleware blocks pending users and signs them out (middleware.ts line 60-67)
- [x] Redirect to `/login?error=pending` with appropriate message
- **PASS**

#### AC-5: Admin sieht im Bereich "Freigaben" eine Liste aller ausstehenden Anfragen
- [x] GET `/api/admin/pending` returns pending users with name, email, created_at
- [x] Frontend page `/admin` (default tab) displays pending list with name, email, date
- [x] Loading, error, and empty states implemented
- **PASS**

#### AC-6: Admin kann eine Anfrage freigeben — Nutzer kann sich einloggen
- [x] POST `/api/admin/pending` sets status to `active` after verifying user is pending
- [x] Confirmation dialog before action
- [x] Toast notification on success
- [ ] BUG: No email notification sent (spec says "Nutzer erhaelt Benachrichtigungs-E-Mail") — BUT implementation notes say "no email notifications" was a design decision. Marking as design deviation, not bug.
- **PASS** (with documented deviation)

#### AC-7: Admin kann eine Anfrage ablehnen — Nutzer wird informiert, Account geloescht
- [x] DELETE `/api/admin/pending` sets status to `deleted` (soft delete)
- [x] Confirmation dialog before action
- [ ] BUG-1: Spec says "Account wird geloescht" but only soft-deleted (status='deleted'). The rejected user's auth.users entry remains, meaning they could potentially re-register with the same email only to be blocked again. This is a design decision documented in Implementation Notes.
- **PASS** (with documented deviation)

#### AC-8: Freigegebene Nutzer verschwinden aus Ausstehend-Liste
- [x] After approval, `fetchPending()` is called to refresh the list
- [x] Approved user will have status='active' and no longer match pending filter
- **PASS**

#### AC-9: Admin sieht Nutzertabelle mit Name, E-Mail, Status, Registrierungsdatum, Anzahl Projekte
- [x] GET `/api/admin/users` returns all fields including project_count
- [x] Users page shows table with all required columns
- [x] Deleted users are excluded from the list (`neq("status", "deleted")`)
- **PASS**

#### AC-10: Admin kann Nutzerliste nach Name/E-Mail filtern
- [x] Search input with debounce (300ms) implemented
- [x] API uses `ilike` on `display_name` and `email`
- [ ] BUG-2: Search query parameter is not sanitized for SQL wildcards — see Security Audit
- **PASS** (functionality works, security issue documented separately)

#### AC-11: Klick auf Nutzer oeffnet Detailansicht mit Projekten
- [x] Table rows are clickable, open `UserDetailSheet`
- [x] Sheet shows user info (name, email, status, date, project count)
- [x] Projects loaded via `useUserProjects()` hook
- **PASS**

#### AC-12: Admin kann Nutzer deaktivieren — kann sich nicht mehr einloggen
- [x] PUT `/api/admin/users/[userId]/status` with `status: "disabled"`
- [x] Middleware blocks disabled users with sign-out and redirect (middleware.ts line 70-76)
- [x] Confirmation dialog before deactivation
- **PASS**

#### AC-13: Admin kann deaktivierten Nutzer reaktivieren
- [x] Reactivate button shown when `user.status === "disabled"` (UserDetailSheet line 207-215)
- [x] Calls `handleStatusAction("active")` directly (no confirmation dialog for reactivation)
- **PASS**

#### AC-14: Admin kann Nutzer dauerhaft loeschen (zweistufiger Bestaetigungsdialog)
- [x] Delete button available for active and disabled users
- [x] Confirmation dialog with warning message
- [ ] BUG-3: Spec requires "zweistufiger Bestaetigungsdialog" (two-step confirmation). Only a single AlertDialog is used. Missing the second confirmation step.
- **FAIL**

#### AC-15: Eigener Admin-Account kann nicht deaktiviert oder geloescht werden
- [x] API prevents self-deactivation/deletion (status route line 44-49)
- [x] Frontend hides action buttons when `isSelf` is true (UserDetailSheet line 189, 232-238)
- [x] Informational message displayed to admin: "Du kannst deinen eigenen Account nicht deaktivieren oder loeschen."
- **PASS**

#### AC-16: Nutzer-Detailansicht zeigt Projekte mit Rolle (Mitglied/Ersteller)
- [x] Projects listed with `project_name`, `role` badge (Ersteller/Mitglied), and `joined_at` date
- **PASS**

#### AC-17: Admin kann Nutzer zu Projekt hinzufuegen (Dropdown mit allen Projekten)
- [x] Dropdown with all non-archived projects (filtered to exclude already-assigned projects)
- [x] POST `/api/admin/users/[userId]/projects` with duplicate check
- [x] Add button with loading state
- **PASS**

#### AC-18: Admin kann Nutzer aus Projekt entfernen (auch Ersteller — mit Warnung)
- [x] Remove button (trash icon) on each project row
- [x] Confirmation dialog before removal
- [x] Owner removal shows amber warning: "Achtung: Dieser Nutzer ist Ersteller des Projekts!"
- **PASS**

#### AC-19: Alternativ Projektansicht mit Mitglieder-Verwaltung
- [ ] Not implemented as a separate view — project member management is only available from the user detail sheet. The spec says "Alternativ" so this is optional.
- **N/A** (optional criterion)

### Edge Cases Status

#### EC-1: Pending user tries to login
- [x] Middleware catches pending status, signs out, redirects to `/login?error=pending`
- [x] LoginForm shows: "Dein Account wartet noch auf Freigabe durch einen Administrator."
- **PASS**

#### EC-2: Disabled user tries to login
- [x] Middleware catches disabled status, signs out, redirects to `/login?error=disabled`
- [x] LoginForm shows: "Dein Account wurde deaktiviert. Kontaktiere den Administrator."
- **PASS**

#### EC-3: Last admin deleted or deactivated
- [x] Self-deactivation/deletion prevented at API level
- [x] Frontend hides actions for own account
- [ ] BUG-4: Only self-deactivation is prevented. If there are two admins, admin A can deactivate admin B. There is no check to prevent deactivation of the LAST admin — only self-protection. If admin A deactivates admin B and then admin B was the only other admin, this is fine. But the system does not prevent admin A from being the only admin and the API still only checks self-ID, not "last admin" status.
- **PARTIAL PASS** (self-protection works, but no "last admin" global check)

#### EC-4: Deleted user as project creator
- [ ] BUG-5: Spec says "Ersteller-Feld zeigt 'Geloeschter Nutzer'; Admin kann neuen Ersteller zuweisen." Neither of these features is implemented. The deleted user's profile still shows in project members (soft delete). There is no mechanism to reassign project ownership.
- **FAIL**

#### EC-5: Deactivated user remains in projects
- [x] Deactivation only changes profile status, does not remove project memberships
- [x] Memberships remain intact as specified
- **PASS**

#### EC-6: Non-admin accessing /admin without admin rights
- [x] Middleware silently redirects to `/dashboard`
- [x] No error message shown (security through obscurity)
- **PASS**

### Cross-Browser Testing (Code Review)

Testing is based on code analysis (no live browser available):

#### Chrome (Desktop)
- [x] Uses standard React/Next.js patterns — no Chrome-specific issues detected
- [x] shadcn/ui components are well-tested across browsers

#### Firefox
- [x] No Firefox-specific API usage detected
- [x] No known incompatibilities in the code patterns used

#### Safari
- [x] No Safari-specific issues detected in code
- [ ] BUG-6: `useSearchParams()` in LoginForm wrapped in Suspense boundary (noted in implementation) — should be verified in Safari as Suspense behavior can differ

#### Responsive Testing (Code Review)

##### Mobile (375px)
- [x] Pending page: flex-col layout on mobile (sm:flex-row for larger)
- [x] Users table: E-Mail column hidden below `sm`, date/projects hidden below `md`
- [x] Mobile shows email under name in users table (line 232-234)
- [x] UserDetailSheet: max-w-md with overflow-y-auto
- [x] Filters stack vertically on mobile (flex-col sm:flex-row)

##### Tablet (768px)
- [x] Two-column layout for filters
- [x] Table shows name + email + status columns

##### Desktop (1440px)
- [x] Full table with all columns visible
- [x] max-w-6xl container prevents overly wide layout

**PASS** (responsive design looks well-implemented)

### Security Audit Results

#### SEC-1: Authentication
- [x] All admin API routes call `getAuthenticatedAdmin()` which verifies auth via `supabase.auth.getUser()`
- [x] Unauthenticated requests get 401 response
- [x] Middleware redirects unauthenticated users on page routes
- **PASS**

#### SEC-2: Authorization (Admin-only access)
- [x] `getAuthenticatedAdmin()` checks `is_admin` flag on profile
- [x] Non-admin authenticated users get 403 response
- [x] Middleware blocks non-admin page access
- [x] RLS policies enforce admin-only access at database level (defense in depth)
- **PASS**

#### SEC-3: Input Validation (Zod)
- [x] All POST/PUT/DELETE endpoints validate input with Zod schemas
- [x] UUID validation on userId and projectId fields
- [x] Status enum validation (only 'active', 'disabled', 'deleted' allowed)
- [x] Invalid JSON body returns 400
- **PASS**

#### SEC-4: SQL Injection via ilike search
- [ ] BUG-7 (SECURITY): In `GET /api/admin/users`, the search parameter is interpolated directly into the Supabase `.or()` filter string: `` `display_name.ilike.%${search}%,email.ilike.%${search}%` ``. While Supabase's PostgREST layer parameterizes the underlying SQL query, the search string is not sanitized for special PostgREST filter characters (e.g., commas, dots, parentheses). A malicious admin could craft a search like `%,id.eq.` to potentially manipulate the filter expression. This is mitigated by the fact that only admins can access this endpoint, but it is still a code smell.
- **Severity: Medium** (only admins can exploit, but filter injection is possible)

#### SEC-5: Rate Limiting
- [ ] BUG-8: No rate limiting on any admin API endpoints. An attacker with a compromised admin session could mass-approve/reject users or mass-modify statuses. While admin endpoints are behind auth, rate limiting is a security best practice.
- **Severity: Low** (admin-only endpoints, but worth noting)

#### SEC-6: Exposed Secrets
- [x] No hardcoded secrets in source code
- [x] Environment variables used for Supabase URL and key
- [x] Admin email hardcoded in migration (acceptable for seed data)
- **PASS**

#### SEC-7: Sensitive Data in API Responses
- [x] User list returns name, email, status, admin flag, dates — appropriate for admin context
- [x] No passwords or tokens exposed
- [ ] BUG-9: `is_admin` flag is returned in user list API responses. While this is needed for the admin UI, if the admin users endpoint were ever exposed (e.g., via misconfigured RLS), the admin flag would reveal which users are high-value targets. Low risk since endpoint is admin-only.
- **PASS** (acceptable for admin-only endpoint)

#### SEC-8: CSRF Protection
- [x] Next.js API routes use standard fetch with JSON body — no CSRF tokens, but:
- [ ] BUG-10: Admin API mutations (POST/PUT/DELETE) do not use CSRF tokens. While modern browsers enforce SameSite cookie policies that provide some CSRF protection, explicit CSRF tokens are a defense-in-depth measure. An attacker could potentially trick an admin into visiting a malicious page that sends requests to the admin API if cookies are SameSite=Lax (which allows GET requests).
- **Severity: Low** (SameSite cookies mitigate, but no explicit CSRF protection)

#### SEC-9: Privilege Escalation
- [x] `updateUserStatusSchema` only allows status values 'active', 'disabled', 'deleted' — cannot set 'pending'
- [ ] BUG-11 (SECURITY): The `PUT /api/admin/users/[userId]/status` endpoint does not prevent an admin from setting their OWN status to 'active' (it only blocks 'disabled' and 'deleted' for self). This is not a bug per se, but more importantly: there is no check preventing an admin from changing the `is_admin` flag of other users. However, the API only allows changing `status`, not `is_admin`, so this is actually safe. The `is_admin` field is not in the update payload.
- **PASS**

#### SEC-10: Middleware bypasses
- [x] API routes are excluded from middleware status checks (they have their own auth)
- [x] Static assets excluded from middleware matcher
- [ ] BUG-12 (SECURITY): The middleware checks profile status for authenticated users on protected routes, but API routes (`/api/*`) are excluded from this check (middleware.ts line 41-42, 44, 51). The admin API routes DO have their own auth check via `getAuthenticatedAdmin()`, which checks `is_admin` but does NOT check `status`. This means a disabled or deleted admin (if such existed) could still call admin APIs directly. The `getAuthenticatedAdmin()` function only checks `is_admin`, not `status`.
- **Severity: High** — If an admin account is disabled but still has `is_admin=true`, they can still call all admin API endpoints.

#### SEC-11: RLS Policy Analysis
- [x] "Admins can view all profiles" policy correctly uses subquery on `auth.uid()`
- [x] "Users can view active profiles" also allows users to see their own profile (`OR id = auth.uid()`)
- [x] Admin insert/delete policies on project_members are correct
- [ ] BUG-13: The UPDATE policy "Users can update own profile" allows any authenticated user to update their own profile row without column restrictions. The API layer prevents setting `status` or `is_admin` directly, but a user with the Supabase client could potentially update their own `status` or `is_admin` via direct Supabase client calls (bypassing the API). RLS does not restrict WHICH columns can be updated.
- **Severity: Critical** — A regular user could set their own `is_admin = true` or `status = 'active'` via direct Supabase client queries from the browser. The Supabase anon key + the user's JWT is enough to call `supabase.from('profiles').update({is_admin: true}).eq('id', myId)` and the RLS policy would allow it.

### Bugs Found

#### BUG-1: Rejected user auth.users entry not cleaned up
- **Severity:** Low
- **Steps to Reproduce:**
  1. Register a new user
  2. Admin rejects the registration
  3. User is soft-deleted (status='deleted') but auth.users entry remains
  4. User cannot re-register with the same email
- **Expected:** Account fully removed or email freed for re-registration
- **Actual:** Soft delete only; auth.users row persists
- **Priority:** Fix in next sprint (documented design decision)

#### BUG-2: Search parameter not sanitized for PostgREST special characters
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Go to /admin/users
  2. Enter search term containing PostgREST filter operators (e.g., commas, dots)
  3. The search string is interpolated into `.or()` filter without escaping
- **Expected:** Special characters are escaped
- **Actual:** Special characters may alter the filter expression
- **Priority:** Fix before deployment

#### BUG-3: Missing two-step confirmation for user deletion
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Go to /admin/users, click on a user
  2. Click "Loeschen"
  3. Only one confirmation dialog appears
- **Expected:** Two-step confirmation dialog (spec: "zweistufiger Bestaetigungsdialog")
- **Actual:** Single AlertDialog confirmation
- **Priority:** Fix before deployment

#### BUG-4: No "last admin" protection beyond self-check
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Have exactly two admin accounts (A and B)
  2. Admin A deactivates Admin B
  3. Admin B deactivates Admin A (if B acts first, before being deactivated)
  4. No admins remain
- **Expected:** System prevents deactivation of the last remaining admin
- **Actual:** Only self-deactivation is prevented; cross-deactivation of all admins is possible
- **Priority:** Fix before deployment

#### BUG-5: Deleted user project ownership handling missing
- **Severity:** Medium
- **Steps to Reproduce:**
  1. User X creates a project
  2. Admin deletes User X
  3. Project still exists but shows deleted user as creator
- **Expected:** Project shows "Geloeschter Nutzer" and admin can reassign ownership
- **Actual:** No special handling; deleted user's profile data may not be visible depending on RLS
- **Priority:** Fix in next sprint

#### BUG-6: Safari Suspense boundary behavior unverified
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open /login in Safari
  2. Navigate with ?error=pending or ?error=disabled query params
  3. Verify the error message displays correctly
- **Expected:** Error message shows correctly
- **Actual:** Unverified; LoginForm uses useSearchParams which requires Suspense boundary
- **Priority:** Nice to have (verify in manual testing)

#### BUG-7: Search filter injection in admin users API
- **Severity:** Medium
- **Steps to Reproduce:**
  1. As admin, call GET /api/admin/users?search=test%2Cid.eq.some-uuid
  2. The comma in the search term could add additional filter clauses to the .or() expression
- **Expected:** Search term is safely escaped
- **Actual:** Raw search string interpolated into PostgREST filter
- **Priority:** Fix before deployment

#### BUG-8: No rate limiting on admin API endpoints
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send rapid repeated requests to POST /api/admin/pending (approve)
  2. No throttling or rate limiting applied
- **Expected:** Rate limiting prevents abuse
- **Actual:** Unlimited requests accepted
- **Priority:** Fix in next sprint

#### BUG-9: is_admin flag exposed in user list API (informational)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Call GET /api/admin/users as admin
  2. Response includes is_admin field for all users
- **Expected:** Acceptable for admin endpoint
- **Actual:** As expected; documented as informational finding
- **Priority:** Nice to have

#### BUG-10: No CSRF protection on admin mutations
- **Severity:** Low
- **Steps to Reproduce:**
  1. Admin is logged in to the app
  2. Admin visits a malicious site that makes fetch requests to /api/admin/pending
  3. If cookies are SameSite=Lax, the POST request may be blocked, but PUT/DELETE could vary
- **Expected:** CSRF tokens protect state-changing requests
- **Actual:** No CSRF tokens; relies on SameSite cookie behavior
- **Priority:** Fix in next sprint

#### BUG-11: Disabled admin can still call admin API endpoints
- **Severity:** High
- **Steps to Reproduce:**
  1. Admin A disables Admin B (who also has is_admin=true)
  2. Admin B's session may still be valid briefly
  3. Admin B calls /api/admin/users or any admin API endpoint
  4. `getAuthenticatedAdmin()` checks is_admin=true but does NOT check status
  5. Admin B can still perform all admin actions despite being disabled
- **Expected:** Disabled users cannot access any API endpoints
- **Actual:** getAuthenticatedAdmin() only checks is_admin flag, not profile status
- **Priority:** Fix before deployment

#### BUG-12: RLS allows users to escalate privileges by updating own profile
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Login as a regular user (is_admin=false, status=active)
  2. Open browser console
  3. Run: `const supabase = (await import('@/lib/supabase')).createClient()`
  4. Run: `await supabase.from('profiles').update({is_admin: true}).eq('id', '<your-user-id>')`
  5. The RLS policy "Users can update own profile" allows this because it only checks `auth.uid() = id`
  6. User is now an admin
- **Expected:** RLS should prevent users from modifying is_admin or status columns
- **Actual:** No column-level restriction in RLS; users can set is_admin=true on their own profile
- **Priority:** Fix before deployment (CRITICAL)

### Regression Testing

#### PROJ-1 (User Authentication)
- [x] Login flow still works (LoginForm.tsx unchanged except for error params)
- [x] Registration flow modified to set status='pending' — new users will be blocked until approved
- [ ] NOTE: Existing users set to 'active' in migration, so no lockout for pre-existing accounts
- [x] Middleware correctly handles auth redirects

#### PROJ-2 (Projektverwaltung)
- [x] Dashboard page updated with admin button — only visible for admins
- [x] Project CRUD not affected by admin changes
- [x] RLS policies for projects extended (new admin policy) but existing user policies not modified
- [x] project_members table has new admin RLS policies (INSERT, DELETE) — existing user policies intact

### Summary
- **Acceptance Criteria:** 14/15 passed (1 failed: BUG-3 two-step delete confirmation missing)
- **Edge Cases:** 4/6 passed (EC-4 failed: deleted user project handling; EC-3 partial: last admin protection)
- **Bugs Found:** 12 total (1 critical, 1 high, 5 medium, 5 low)
- **Security:** Issues found (1 critical privilege escalation, 1 high disabled-admin bypass)
- **Production Ready:** **NO**
- **Recommendation:** Fix critical and high bugs first (BUG-12 privilege escalation via RLS, BUG-11 disabled admin API access), then address medium bugs (BUG-3 two-step delete, BUG-4 last admin check, BUG-2/BUG-7 search sanitization) before deployment.

## Deployment
_To be added by /deploy_
