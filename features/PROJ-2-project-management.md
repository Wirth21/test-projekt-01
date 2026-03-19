# PROJ-2: Projektverwaltung

## Status: In Review
**Created:** 2026-03-13
**Last Updated:** 2026-03-14

## Dependencies
- Requires: PROJ-1 (User Authentication) — alle Projekte gehören eingeloggten Nutzern

## Overview
Nutzer können Projekte anlegen, verwalten und mit Teammitgliedern teilen. Jedes Projekt ist ein Container für PDFs und deren Marker. Alle Teammitglieder haben Zugriff auf gemeinsame Projekte.

## User Stories
- Als Nutzer möchte ich ein neues Projekt anlegen (mit Name und optionaler Beschreibung), damit ich meine Pläne strukturiert ablegen kann.
- Als Nutzer möchte ich alle Projekte auf einer Übersichtsseite sehen, damit ich schnell zum richtigen Projekt navigieren kann.
- Als Nutzer möchte ich ein Projekt umbenennen oder die Beschreibung ändern, damit ich es aktuell halten kann.
- Als Nutzer möchte ich ein Projekt archivieren, wenn es nicht mehr aktiv benötigt wird (kein Löschen möglich — siehe PROJ-6).
- Als Nutzer möchte ich andere Nutzer zu einem Projekt einladen, damit das Team gemeinsam daran arbeiten kann.
- Als eingeladener Nutzer möchte ich alle PDFs und Marker eines geteilten Projekts sehen und bearbeiten können.

## Acceptance Criteria
- [ ] Nutzer kann ein Projekt mit Name (Pflichtfeld) und Beschreibung (optional) anlegen
- [ ] Projektübersicht zeigt alle eigenen und geteilten Projekte als Kachelansicht
- [ ] Jedes Projekt zeigt: Name, Beschreibung, Anzahl PDFs, Datum der letzten Änderung
- [ ] Nutzer kann Projektname und -beschreibung bearbeiten
- [ ] Nutzer kann ein Projekt archivieren (kein Löschen möglich) — Details in PROJ-6
- [ ] Nutzer kann andere registrierte Nutzer per E-Mail zu einem Projekt einladen
- [ ] Eingeladene Nutzer sehen das geteilte Projekt in ihrer Projektübersicht
- [ ] Nur Projektersteller kann Projekt archivieren oder weitere Mitglieder einladen

## Edge Cases
- Was passiert beim Anlegen eines Projekts mit einem bereits verwendeten Namen? → Erlaubt (Namen müssen nicht eindeutig sein)
- Was passiert wenn ein Projekt archiviert wird, das PDFs mit Markern enthält? → Bestätigungsdialog warnt, alle Inhalte werden archiviert aber nicht gelöscht (Details in PROJ-6)
- Was passiert wenn man einen Nutzer einlädt, der nicht registriert ist? → Fehlermeldung "Kein Nutzer mit dieser E-Mail gefunden"
- Was passiert wenn man versucht, sich selbst einzuladen? → Fehlermeldung
- Was passiert wenn das letzte Mitglied ein Projekt verlässt? → Projekt wird nicht automatisch archiviert, bleibt bestehen

## Technical Requirements
- Datenbankstruktur: `projects` Tabelle + `project_members` Join-Tabelle
- RLS (Row Level Security): Nur Projektmitglieder dürfen Projektdaten sehen/bearbeiten
- Kein Cascading Delete — Archivierung statt Löschen (siehe PROJ-6)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## Implementation Notes (Backend)
**Migration:** `supabase/migrations/002_projects.sql`

### Database Tables Created
- **`projects`** -- id (UUID PK), name (TEXT, 1-100 chars), description (TEXT, max 500 chars, nullable), created_by (FK auth.users), is_archived (BOOLEAN), created_at, updated_at
- **`project_members`** -- id (UUID PK), project_id (FK projects), user_id (FK auth.users), role ('owner'|'member'), joined_at, UNIQUE(project_id, user_id)

### RLS Policies
- **projects SELECT:** Only project members can view
- **projects INSERT:** Authenticated users, must set created_by = own uid
- **projects UPDATE:** Only owner role can update
- **projects DELETE:** No policy (denied by default -- archiving only)
- **project_members SELECT:** Members can see other members of their projects
- **project_members INSERT:** Owner can invite members; creator can self-add as owner
- **project_members DELETE:** Owner can remove members; members can self-remove
- **project_members UPDATE:** No policy (denied by default)

### Indexes
- projects: created_by, is_archived, updated_at DESC
- project_members: user_id, project_id, role

### Frontend Integration
- Types: `src/lib/types/project.ts` (Project, ProjectMember, ProjectWithRole)
- Validations: `src/lib/validations/project.ts` (Zod schemas for create, edit, invite)
- Hooks: `src/hooks/use-projects.ts` (useProjects, useProjectMembers)
- Components: CreateProjectDialog, EditProjectDialog, InviteMemberDialog, ProjectCard
- Pages: Dashboard with project list, project detail page with member management

## QA Test Results

**Tested:** 2026-03-15
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code review of all implementation files + architecture analysis (no live Supabase instance available)

### Acceptance Criteria Status

#### AC-1: Nutzer kann ein Projekt mit Name (Pflichtfeld) und Beschreibung (optional) anlegen
- [x] CreateProjectDialog implements form with name (required) and description (optional)
- [x] Zod schema enforces name min 1 / max 100 chars, description max 500 chars
- [x] `useProjects.createProject()` inserts into `projects` table and adds creator as owner in `project_members`
- [x] DB constraint `CHECK (char_length(name) >= 1 AND char_length(name) <= 100)` enforces server-side
- [x] Success toast shown after creation
- **PASS**

#### AC-2: Projektuebersicht zeigt alle eigenen und geteilten Projekte als Kachelansicht
- [x] Dashboard page renders projects in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- [x] `useProjects` fetches all projects where user is a member (both owned and shared)
- [x] Empty state shown when no projects exist with CTA to create first project
- [x] Loading skeleton shown during fetch
- **PASS**

#### AC-3: Jedes Projekt zeigt: Name, Beschreibung, Anzahl PDFs, Datum der letzten Aenderung
- [x] ProjectCard displays project name with link to detail page
- [x] ProjectCard displays description (or "Keine Beschreibung" if null)
- [x] ProjectCard displays PDF count (`project.pdf_count ?? 0`)
- [ ] BUG: `pdf_count` is always `undefined`/0 because it is not fetched from the database. The `projects` table has no `pdf_count` column, and the query in `useProjects` does `select("*")` which would not include a count of related PDFs. The type defines it as `pdf_count?: number` (optional), so it always falls back to 0. See BUG-1.
- [x] ProjectCard displays last updated date in German format (dd.mm.yyyy)
- **PARTIAL PASS** (pdf_count always shows 0)

#### AC-4: Nutzer kann Projektname und -beschreibung bearbeiten
- [x] EditProjectDialog pre-fills current name and description
- [x] Uses same Zod validation schema as create
- [x] `useProjects.updateProject()` updates via Supabase and sets `updated_at`
- [x] Only owners see the "Bearbeiten" menu option (enforced in ProjectCard UI)
- [x] RLS policy restricts UPDATE to owner role
- **PASS**

#### AC-5: Nutzer kann ein Projekt archivieren (kein Loeschen moeglich)
- [x] Archive option available in ProjectCard dropdown menu (owner only)
- [x] Confirmation dialog shown with warning text before archiving
- [x] `useProjects.archiveProject()` sets `is_archived = true`
- [x] Archived projects filtered out by `fetchProjects` query (`.eq("is_archived", false)`)
- [x] No DELETE policy on `projects` table -- deletion denied by RLS default
- [ ] BUG: The archive confirmation dialog does not specifically mention PDFs and markers as the spec requires ("Bestaetigungsdialog warnt, alle Inhalte werden archiviert"). The current text says "Alle PDFs und Marker bleiben erhalten" but this is cosmetic. See BUG-2.
- **PASS** (core functionality works, edge case text could be improved)

#### AC-6: Nutzer kann andere registrierte Nutzer per E-Mail zu einem Projekt einladen
- [x] InviteMemberDialog with email input and Zod validation
- [x] `useProjectMembers.inviteMember()` looks up user by email in profiles table
- [x] Inserts new `project_members` row with role "member"
- [x] Error handling for non-existent user, self-invite, already-member
- [x] Server error displayed in dialog via Alert component
- **PASS**

#### AC-7: Eingeladene Nutzer sehen das geteilte Projekt in ihrer Projektuebersicht
- [x] `useProjects.fetchProjects()` queries `project_members` for current user, then fetches all matching projects
- [x] RLS policy on `projects SELECT` allows access for any project member
- [x] Invited members see the project with role badge "Mitglied"
- **PASS**

#### AC-8: Nur Projektersteller kann Projekt archivieren oder weitere Mitglieder einladen
- [x] ProjectCard UI: edit, invite, archive options only shown when `project.role === "owner"`
- [x] Non-owners see only "Oeffnen" in the dropdown menu
- [x] Project detail page: invite button only shown to owners
- [x] RLS policy: UPDATE on projects restricted to owner role
- [x] RLS policy: INSERT on project_members restricted to owner (or self-add as owner on own project)
- [ ] BUG: Authorization is enforced at both UI and RLS level, which is good. However, the `archiveProject` function in `use-projects.ts` does not check the role client-side before sending the request. While RLS will block the request, the error message returned would be generic ("Projekt konnte nicht archiviert werden") rather than a clear "only the owner can archive" message. This is a minor UX issue. See BUG-3.
- **PASS** (security is correct via RLS, UX could be improved)

### Edge Cases Status

#### EC-1: Projekt mit bereits verwendetem Namen anlegen
- [x] No unique constraint on `projects.name` in the database schema
- [x] No client-side check for duplicate names
- [x] Spec says this is allowed -- correctly implemented
- **PASS**

#### EC-2: Projekt archivieren das PDFs mit Markern enthaelt
- [x] Archive confirmation dialog is shown
- [x] Dialog text mentions PDFs and markers being preserved
- [ ] BUG: PROJ-3 (PDF Upload) and PROJ-4 (Markers) are not yet implemented, so this cannot be fully tested. The current archive operation only sets `is_archived = true` on the project. There is no cascading archive of related PDFs/markers because those tables do not exist yet. This is acceptable for now but must be re-tested when PROJ-3 and PROJ-4 are implemented. See BUG-4.
- **PARTIAL PASS** (deferred -- depends on PROJ-3/PROJ-4)

#### EC-3: Nutzer einladen der nicht registriert ist
- [x] `inviteMember()` queries `profiles` table by email
- [x] If no profile found, throws "Kein Nutzer mit dieser E-Mail gefunden"
- [x] Error displayed in InviteMemberDialog via Alert
- **PASS**

#### EC-4: Sich selbst einladen
- [x] `inviteMember()` checks `user.email === email` before proceeding
- [x] Throws "Du kannst dich nicht selbst einladen"
- [ ] BUG: The self-invite check compares the logged-in user's `user.email` (from `supabase.auth.getUser()`) with the input email using strict equality. This comparison is case-sensitive. If the user's email is stored as "User@Example.com" and they type "user@example.com", the check would not catch the self-invite attempt, and the RLS unique constraint would either error or (if the IDs match) produce a confusing database error. See BUG-5.
- **PARTIAL PASS** (works for exact case match, fails for case-insensitive match)

#### EC-5: Letztes Mitglied verlaesst Projekt
- [x] RLS DELETE policy allows members to self-remove (`user_id = auth.uid()`)
- [x] No trigger or check to prevent the owner from leaving
- [ ] BUG: The owner can remove themselves from the project via `removeMember`. If the owner leaves, the project becomes orphaned -- no one can update, archive, or invite members because all those operations require the "owner" role. The project remains visible to remaining members but becomes unmanageable. The spec says "Projekt wird nicht automatisch archiviert, bleibt bestehen" which is technically met, but the project becomes a zombie with no administrative control. See BUG-6.
- **PARTIAL PASS** (project persists but becomes unmanageable if owner leaves)

### Security Audit Results

#### Authentication
- [x] Dashboard page is under `(protected)` layout which requires auth via `createServerSupabaseClient`
- [x] Middleware redirects unauthenticated users to `/login`
- [x] `useProjects` and `useProjectMembers` check for user before operations
- [x] All Supabase queries use the authenticated client (anon key + user JWT)

#### Authorization (IDOR / Horizontal Privilege Escalation)
- [x] RLS on `projects` SELECT: only project members can view
- [x] RLS on `projects` UPDATE: only owners can update
- [x] RLS on `projects` INSERT: `created_by = auth.uid()` enforced
- [x] RLS on `project_members` INSERT: only owners can add members (or creator self-add)
- [x] RLS on `project_members` DELETE: owner or self-remove only
- [ ] BUG: The `updateProject` function in `use-projects.ts` only filters by `.eq("id", id)` without also checking that the current user is the owner. While RLS prevents unauthorized updates at the database level, a malicious user could call `updateProject("other-project-id", ...)` from the browser console. RLS would block it, but the function does not provide a meaningful error -- it would just show "Projekt konnte nicht aktualisiert werden". This is defense-in-depth working correctly but UX for the attacker-case is acceptable. **No real vulnerability** -- RLS protects properly.
- [ ] BUG: The `inviteMember` function queries the `profiles` table to look up users by email. The RLS on profiles allows all authenticated users to SELECT all profiles. This means any authenticated user can enumerate all registered users' email addresses by querying the profiles table. This is intentional per the spec (team overview) but should be noted as a data exposure consideration. See BUG-7.

#### Input Validation
- [x] Client-side: Zod schemas validate project name (1-100 chars), description (max 500), email format
- [x] Server-side: DB constraints enforce name length and description length
- [ ] BUG: There is NO server-side API route for project operations. All CRUD goes directly from the browser client to Supabase via the anon key + JWT. While Supabase RLS and DB constraints provide protection, there is no server-side Zod validation layer for project create/update operations. Input validation relies entirely on client-side Zod + DB constraints. A user could bypass client-side validation by making direct Supabase API calls from the browser console. The DB constraints (char_length checks) would still enforce limits, but there is no sanitization layer. See BUG-8.

#### XSS Prevention
- [x] React JSX auto-escapes all rendered values
- [x] No use of `dangerouslySetInnerHTML`
- [x] Project names and descriptions rendered as text nodes, not HTML
- [x] Form inputs controlled via react-hook-form

#### Data Leakage
- [x] Project data only accessible to members (RLS enforced)
- [x] Member profiles show display_name and email (intentional for team features)
- [ ] BUG: The `useProjects` hook creates a new Supabase client on every render via `createClient()`. This should use a singleton or memoized client to avoid unnecessary overhead. While not a security issue, it could lead to session inconsistencies in edge cases. See BUG-9.

#### Rate Limiting
- [ ] BUG: No rate limiting on project creation, invitation, or archival operations. A malicious user could create thousands of projects or send mass invitations rapidly. Supabase has some built-in rate limiting on the API level, but there is no application-level throttling. See BUG-10.

#### Security Headers
- [x] Security headers configured in `next.config.ts` (X-Frame-Options, CSP, HSTS, etc.) -- this was noted as BUG-5 in PROJ-1 QA but has since been fixed

### Cross-Browser Assessment (Code Review)
- [x] Standard React/Next.js patterns -- no browser-specific APIs
- [x] Tailwind CSS responsive grid layout -- works across browsers
- [x] Dialog components from shadcn/ui (Radix primitives) -- cross-browser compatible
- [x] `line-clamp-2`, `line-clamp-3` Tailwind utilities -- supported in modern Chrome, Firefox, Safari
- [x] No CSS features requiring vendor prefixes beyond what Tailwind provides

### Responsive Assessment (Code Review)
- [x] Dashboard grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` -- properly responsive
- [x] ProjectCard uses flex layout with overflow handling (`min-w-0`, `truncate`, `line-clamp`)
- [x] Dialogs use `sm:max-w-md` -- full width on mobile, constrained on larger screens
- [x] Header uses `flex items-center justify-between` with `px-4` padding
- [x] Project detail page uses `max-w-4xl mx-auto px-4` -- centered with side padding
- [x] Archive confirmation modal has `max-w-sm w-full mx-4` -- responsive with margin
- [ ] BUG: The archive confirmation dialog is a custom modal (`fixed inset-0 z-50`) rather than using the shadcn/ui Dialog component. This means it lacks proper accessibility features (focus trapping, Escape key to close, aria attributes) and may behave inconsistently compared to other dialogs in the app. See BUG-11.

### Regression Assessment (PROJ-1)
- [x] Login/Register pages: not modified by PROJ-2 changes
- [x] Middleware: not modified -- still protects all routes correctly
- [x] Protected layout: not modified -- still checks auth server-side
- [x] Logout: implemented in dashboard page, calls `signOut()` correctly
- [x] Profile API routes: not modified
- [ ] NOTE: Dashboard page was previously a placeholder (from PROJ-1). It has been fully replaced with the project management UI. The "Abmelden" button is still present in the header. No regression detected.

### Bugs Found

#### BUG-1: PDF Count Always Shows 0
- **Severity:** Low
- **Steps to Reproduce:**
  1. Create a project
  2. View project card on dashboard
  3. Expected: PDF count reflects actual number of PDFs (once PROJ-3 is implemented)
  4. Actual: Always shows "0 PDFs" because `pdf_count` is not fetched from the database. The `projects` table has no such column, and the query does not join/count related PDFs
- **Priority:** Fix when PROJ-3 (PDF Upload) is implemented -- currently acceptable since no PDFs can be uploaded yet

#### BUG-2: Archive Confirmation Dialog Text Could Be More Specific
- **Severity:** Low
- **Steps to Reproduce:**
  1. Click "Archivieren" on a project
  2. Read the confirmation text
  3. Expected: Warning specifically mentions that PDFs and markers will be archived (per edge case spec)
  4. Actual: Text says "Alle PDFs und Marker bleiben erhalten, aber das Projekt wird aus der Uebersicht ausgeblendet" which is actually adequate
- **Priority:** Nice to have -- text is functional

#### BUG-3: No Client-Side Role Check Before Archive/Update Requests
- **Severity:** Low
- **Steps to Reproduce:**
  1. As a non-owner member, call `archiveProject(projectId)` from browser console
  2. Expected: Clear error message "Only the owner can archive this project"
  3. Actual: Generic error "Projekt konnte nicht archiviert werden" (RLS blocks correctly but error is unhelpful)
- **Priority:** Nice to have

#### BUG-4: Archive Does Not Cascade to PDFs/Markers (Not Yet Applicable)
- **Severity:** Low (deferred)
- **Steps to Reproduce:**
  1. Wait for PROJ-3 and PROJ-4 implementation
  2. Upload PDFs and create markers
  3. Archive the project
  4. Expected: PDFs and markers should be archived or hidden along with the project
  5. Actual: Only `is_archived` flag on project is set. No cascading behavior exists yet
- **Priority:** Must be addressed when PROJ-3/PROJ-4 are built

#### BUG-5: Self-Invite Check Is Case-Sensitive
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Log in with email "User@Example.com"
  2. Go to a project you own
  3. Click "Mitglied einladen"
  4. Enter "user@example.com" (different case)
  5. Expected: Error "Du kannst dich nicht selbst einladen"
  6. Actual: The case-sensitive comparison `user.email === email` does not match. The invite proceeds to the profiles table lookup, which may find the same user (if email is stored lowercase) and attempt to insert a duplicate `project_members` row, resulting in a DB unique constraint error with an unhelpful error message
- **Priority:** Fix before deployment

#### BUG-6: Owner Can Leave Project -- Creates Orphaned/Unmanageable Project
- **Severity:** High
- **Steps to Reproduce:**
  1. Create a project
  2. Invite another member
  3. Go to project detail page
  4. As the owner, the UI does not show a "remove" button for themselves (good), BUT the `removeMember` function can be called via browser console with the owner's membership ID
  5. Expected: Owner cannot be removed, or ownership is transferred
  6. Actual: Owner is removed. The project still exists and is visible to remaining members, but no one has the "owner" role. No one can edit, archive, or invite new members. The project becomes a zombie
  7. Note: Even through the UI, the owner could leave if they are also listed as a member row and the remove button shows for them (the UI only hides remove for the owner badge, but the RLS DELETE policy allows self-remove regardless of role)
- **Priority:** Fix before deployment

#### BUG-7: All User Emails Queryable by Any Authenticated User
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Log in as any user
  2. Open browser console
  3. Run: `const { data } = await supabase.from('profiles').select('email'); console.log(data)`
  4. Expected: Only see emails of users in your projects
  5. Actual: All registered users' emails are visible because the profiles RLS policy allows all authenticated users to SELECT all profiles
- **Priority:** Fix in next sprint -- this is intentional for the team invite feature but exposes all user emails to every authenticated user. Consider restricting to project co-members or implementing a server-side search endpoint with rate limiting

#### BUG-8: No Server-Side Validation for Project Operations
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Open browser console
  2. Create a Supabase client and call `supabase.from('projects').insert({ name: '<script>alert(1)</script>', created_by: userId })`
  3. Expected: Server-side validation rejects or sanitizes the input
  4. Actual: The insert succeeds because there is no server-side API route with Zod validation. DB constraints only check length, not content. While React auto-escapes on render (preventing XSS display), the malicious content is stored in the database
- **Priority:** Fix before deployment -- add server-side API routes with Zod validation, or at minimum ensure DB-level sanitization. React's auto-escaping prevents XSS on render, but stored malicious content could be an issue if data is consumed by other clients or exported

#### BUG-9: Supabase Client Created on Every Render
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review `use-projects.ts` line 13: `const supabase = createClient()`
  2. This is called on every render of any component using `useProjects` or `useProjectMembers`
  3. Expected: Client should be memoized or created once
  4. Actual: `createBrowserClient` from `@supabase/ssr` likely handles deduplication internally (it typically returns a singleton), so this is more of a code quality issue than a real bug
- **Priority:** Nice to have

#### BUG-10: No Rate Limiting on Project Operations
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Open browser console
  2. Run a loop creating 1000 projects rapidly
  3. Expected: Rate limiting prevents abuse
  4. Actual: No application-level rate limiting. Supabase has some built-in limits but they may be generous
- **Priority:** Fix in next sprint

#### BUG-11: Archive Confirmation Uses Custom Modal Instead of shadcn/ui Dialog
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Click "Archivieren" on a project card
  2. The confirmation dialog appears
  3. Press Escape key
  4. Expected: Dialog closes (standard dialog behavior)
  5. Actual: The custom modal (`fixed inset-0 z-50 flex...`) has no keyboard event handling. No focus trapping, no Escape-to-close, no aria-labelledby/describedby attributes. This violates accessibility standards and the project convention of using shadcn/ui components first
  6. Additionally, the CLAUDE.md states: "shadcn/ui first: NEVER create custom versions of installed shadcn components" -- AlertDialog from shadcn/ui should be used here
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 7/8 passed, 1 partial (AC-3: pdf_count always 0)
- **Edge Cases:** 3/5 passed, 2 partial (EC-4: case-sensitive self-invite, EC-5: orphaned project on owner leave)
- **Bugs Found:** 11 total (0 critical, 1 high, 4 medium, 6 low)
- **Security:** Issues found (email enumeration, no server-side validation, no rate limiting, orphaned project risk)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-6 (owner leave creates orphan), BUG-5 (case-sensitive self-invite), BUG-8 (no server-side validation), and BUG-11 (custom modal instead of shadcn/ui AlertDialog) before deployment. BUG-7 and BUG-10 should be addressed in the next sprint. Remaining low-severity bugs can be deferred.

## Deployment
_To be added by /deploy_
