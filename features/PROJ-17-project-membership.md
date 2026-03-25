# PROJ-17: Projektmitgliedschaft & Selbstverwaltung

## Status: In Review
**Created:** 2026-03-25
**Last Updated:** 2026-03-25

## Dependencies
- Requires: PROJ-1 (User Authentication) -- Nutzer müssen eingeloggt sein
- Requires: PROJ-2 (Projektverwaltung) -- Projekte und Mitgliedschaften existieren bereits
- Requires: PROJ-6 (Archivierungssystem) -- Archivierte Projekte als Basis für den "Archiv"-Reiter

## Overview
Die Projektübersicht wird um einen dritten Reiter "Inaktive Projekte" erweitert. Dort sieht der Nutzer alle Projekte, in denen er **kein** Mitglied ist. Er kann sich dort selbstständig als Mitglied eintragen (Beitreten) oder sich aus bestehenden Projekten wieder austragen (Verlassen). In der Projektdetailseite wird ganz unten eine vollständige Mitgliederliste angezeigt. Beim Einladen von Nutzern erscheint eine Auswahl der verfügbaren Nutzer (nicht nur E-Mail-Eingabe).

## User Stories
- Als Nutzer möchte ich in einem Reiter "Inaktive Projekte" alle Projekte sehen, in denen ich kein Mitglied bin, damit ich relevante Projekte selbst finden und beitreten kann.
- Als Nutzer möchte ich mich selbst zu einem Projekt hinzufügen (beitreten), ohne dass der Ersteller mich einladen muss.
- Als Nutzer möchte ich mich selbst aus einem Projekt austragen (verlassen), wenn ich nicht mehr daran beteiligt bin.
- Als Nutzer möchte ich in der Projektdetailseite alle Mitglieder des Projekts sehen, damit ich weiß, wer am Projekt beteiligt ist.
- Als Projektersteller möchte ich beim Einladen eines Mitglieds eine Auswahl der registrierten Nutzer sehen (nicht nur E-Mail-Eingabe), damit ich schneller die richtige Person finde.

## Acceptance Criteria

### Reiter "Inaktive Projekte"
- [ ] Im Dashboard gibt es drei Reiter: "Aktive Projekte", "Inaktive Projekte", "Archiv"
- [ ] Der Reiter "Inaktive Projekte" zeigt alle nicht-archivierten Projekte, in denen der aktuelle Nutzer **kein** Mitglied ist
- [ ] Jedes Projekt im "Inaktive"-Reiter zeigt: Projektname, Beschreibung, Anzahl Mitglieder
- [ ] Ein "Beitreten"-Button ist auf jeder Projektkarte im "Inaktive"-Reiter sichtbar
- [ ] Nach dem Beitreten verschwindet das Projekt aus "Inaktive" und erscheint in "Aktive Projekte"
- [ ] Leerer Zustand: "Es gibt keine Projekte, denen du beitreten könntest" wenn alle Projekte bereits beigetreten

### Selbst-Austritt (Projekt verlassen)
- [ ] In der Projektdetailseite gibt es einen "Projekt verlassen"-Button für Mitglieder (nicht-Ersteller)
- [ ] Vor dem Verlassen erscheint ein Bestätigungsdialog
- [ ] Nach dem Verlassen wird der Nutzer zur Dashboard-Übersicht weitergeleitet
- [ ] Das verlassene Projekt erscheint nun im Reiter "Inaktive Projekte"
- [ ] Der Projektersteller kann das Projekt nicht verlassen (Button wird nicht angezeigt)

### Mitgliederliste im Projekt
- [ ] Ganz unten auf der Projektdetailseite gibt es einen Bereich "Mitglieder"
- [ ] Alle aktuellen Mitglieder werden in einer Liste angezeigt: Name, E-Mail, Rolle (Ersteller/Mitglied), Beitrittsdatum
- [ ] Der Projektersteller ist als "Ersteller" gekennzeichnet
- [ ] Der Projektersteller kann Mitglieder aus dem Projekt entfernen (Icon-Button mit Bestätigungsdialog)
- [ ] Normale Mitglieder sehen die Liste, können aber keine anderen Mitglieder entfernen

### Verbesserte Einladung (Nutzerauswahl)
- [ ] Beim Einladen wird statt eines reinen E-Mail-Eingabefeldes eine Auswahlliste/Dropdown mit allen registrierten Nutzern angezeigt
- [ ] Die Nutzerliste ist durchsuchbar (nach Name oder E-Mail)
- [ ] Bereits eingeladene Mitglieder werden in der Auswahlliste ausgefiltert oder als "Bereits Mitglied" markiert
- [ ] Der Ersteller kann sich selbst nicht einladen (wird ausgefiltert)
- [ ] Nach dem Einladen wird die Mitgliederliste aktualisiert

## Edge Cases
- Was passiert, wenn ein Nutzer einem Projekt beitritt, das viele Zeichnungen enthält? -> Normaler Beitritt; der Nutzer hat sofort Zugriff auf alle Zeichnungen (RLS über project_members)
- Was passiert, wenn der letzte Nicht-Ersteller das Projekt verlässt? -> Erlaubt; der Ersteller bleibt als einziges Mitglied
- Was passiert, wenn ein Nutzer ein Projekt verlässt, in dem er Marker erstellt hat? -> Marker bleiben erhalten (gehören dem Projekt, nicht dem Nutzer)
- Was passiert bei gleichzeitigem Beitritt und Einladung desselben Nutzers? -> UNIQUE-Constraint auf project_members verhindert Duplikate; Fehlermeldung "Bereits Mitglied"
- Was passiert, wenn es keine inaktiven Projekte gibt? -> Leerer Zustand wird angezeigt
- Sollen archivierte Projekte im "Inaktive"-Reiter erscheinen? -> Nein, archivierte Projekte bleiben im "Archiv"-Reiter. "Inaktive" zeigt nur aktive Projekte, denen der Nutzer nicht angehört

## Technical Requirements
- Neuer API-Endpunkt: `GET /api/projects/inactive` -- listet alle nicht-archivierten Projekte, in denen der aktuelle Nutzer kein Mitglied ist
- Neuer API-Endpunkt: `POST /api/projects/[id]/join` -- Nutzer tritt einem Projekt bei (erstellt project_members-Eintrag mit Rolle "member")
- Neuer API-Endpunkt: `POST /api/projects/[id]/leave` -- Nutzer verlässt ein Projekt (löscht eigenen project_members-Eintrag)
- Neuer API-Endpunkt: `GET /api/users/available?projectId=[id]` -- listet alle registrierten Nutzer, die noch nicht Mitglied des Projekts sind (für Einladungs-Dropdown)
- RLS-Anpassung: `projects` SELECT-Policy muss erweitert werden, damit auch Nicht-Mitglieder die Basisdaten (Name, Beschreibung) von nicht-archivierten Projekten sehen können
- Bestehende Mitgliederliste in der Projektdetailseite nutzt die vorhandene `useProjectMembers`-Hook-Logik
- Browser Support: Chrome, Firefox, Safari (aktuellste Versionen)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
**Erstellt:** 2026-03-25

### Wichtiger Hinweis
PROJ-17 erfordert sowohl Frontend- als auch Backend-Änderungen. Die RLS-Policy für `projects` muss erweitert werden, damit Nicht-Mitglieder die Basisdaten von Projekten sehen können (für den "Inaktive Projekte"-Reiter).

---

### Komponenten-Struktur

```
Dashboard /dashboard
+-- Header (bestehend)
+-- Tabs (erweitert: 3 statt 2 Reiter)
    +-- TabsTrigger "Aktive Projekte" (bestehend)
    +-- TabsTrigger "Inaktive Projekte" (NEU)
    +-- TabsTrigger "Archiv" (bestehend)
    +-- TabsContent "active" (bestehend -- eigene Projekte)
    +-- TabsContent "inactive" (NEU)
    |   +-- InactiveProjectCard[] (NEU)
    |       +-- Projektname, Beschreibung, Mitgliederanzahl
    |       +-- "Beitreten"-Button
    +-- TabsContent "archived" (bestehend)

Projektdetailseite /dashboard/projects/[id]
+-- Header (bestehend)
+-- Zeichnungen-Bereich (bestehend)
+-- Mitglieder-Bereich (NEU / erweitert -- ganz unten)
    +-- MemberList (NEU)
    |   +-- MemberRow[] (Name, E-Mail, Rolle-Badge, Beitrittsdatum)
    |   |   +-- RemoveMemberButton (nur für Owner sichtbar)
    +-- InviteMemberButton (bestehend, nur für Owner)
    +-- LeavProjectButton (NEU, nur für Nicht-Owner)

InviteMemberDialog (überarbeitet)
+-- Durchsuchbare Nutzerauswahl (NEU -- ersetzt E-Mail-Eingabe)
    +-- Suchfeld (Name oder E-Mail)
    +-- Nutzerliste (gefiltert, ohne bereits eingeladene)
    +-- Nutzer-Eintrag (Name, E-Mail, "Einladen"-Button)
```

### Datenmodell

**Keine neuen Tabellen** -- alle Daten nutzen bestehende `projects`, `project_members` und `profiles` Tabellen.

**RLS-Änderung:**
- `projects` SELECT-Policy wird erweitert: Alle authentifizierten Nutzer dürfen nicht-archivierte Projekte lesen (für den Inaktive-Reiter). Bisher: nur Mitglieder.
- Alternative: Neue RLS-Policy "Authenticated users can view non-archived projects" (nur Basisdaten: id, name, description, created_at)

### API-Routen

- `GET /api/projects/inactive` -- Alle nicht-archivierten Projekte, in denen der Nutzer KEIN Mitglied ist. Liefert: id, name, description, member_count
- `POST /api/projects/[id]/join` -- Nutzer tritt Projekt bei (erstellt project_members-Eintrag mit Rolle "member"). Prüft: Projekt existiert, nicht archiviert, Nutzer noch kein Mitglied
- `POST /api/projects/[id]/leave` -- Nutzer verlässt Projekt (löscht eigenen project_members-Eintrag). Prüft: Nutzer ist Mitglied, Nutzer ist NICHT Owner
- `GET /api/users/available?projectId=[id]` -- Alle aktiven Nutzer, die noch nicht Mitglied des Projekts sind. Für Einladungs-Dropdown. Liefert: id, display_name, email

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Inaktive Projekte | Eigener API-Endpunkt | Separater Query; nicht in bestehende Projekt-Liste mischen |
| Selbst-Beitritt | Neuer /join Endpunkt | Klare Trennung von Einladung (Owner) und Selbst-Beitritt (Nutzer) |
| Nutzerauswahl | Combobox/Command (shadcn) | Durchsuchbar, bereits als UI-Komponente vorhanden |
| Mitgliederliste | Im Projekt unten | Konsistent mit bestehender Projektdetailseite |
| RLS-Erweiterung | Separate Policy für Basis-Lesen | Bestehende Member-Policy bleibt unverändert; neue Policy nur für Lese-Zugriff |

### Neue Abhängigkeiten

Keine -- `Command` (Combobox) und `Popover` sind bereits als shadcn/ui-Komponenten installiert.

## Frontend Implementation Notes
**Implemented:** 2026-03-25

### Changes made:
1. **Dashboard page** (`src/app/(protected)/dashboard/page.tsx`):
   - Added third tab "Inaktive Projekte" between "Aktiv" and "Archiv"
   - Inactive tab shows projects the user is NOT a member of, with project name, description, member count, and "Beitreten" button
   - Empty state when no inactive projects available
   - Loading skeleton state while fetching

2. **Project detail page** (`src/app/(protected)/dashboard/projects/[id]/page.tsx`):
   - Added "Projekt verlassen" button for non-owners in the members section header
   - Leave button triggers confirmation dialog; after leaving, redirects to dashboard
   - Enhanced member list with joined_at dates
   - Remove member now uses confirmation dialog (AlertDialog) instead of direct action
   - Remove button uses X icon with aria-label for accessibility

3. **InviteMemberDialog** (`src/components/projects/InviteMemberDialog.tsx`):
   - Complete rework: replaced email input with searchable user selection list
   - Fetches available users from `GET /api/users/available?projectId=[id]`
   - Search field filters by name or email
   - Already-invited users show "Bereits Mitglied" badge with checkmark
   - Each user row has avatar initial, name, email, and "Einladen" button

4. **use-projects hook** (`src/hooks/use-projects.ts`):
   - Added `inactiveProjects`, `inactiveLoading`, `fetchInactiveProjects`
   - Added `joinProject(projectId)` calling `POST /api/projects/[id]/join`
   - Added `leaveProject(projectId)` calling `POST /api/projects/[id]/leave`

5. **Types** (`src/lib/types/project.ts`):
   - Added `member_count?: number` to `Project` interface

6. **i18n translations** (`src/messages/de.json`, `src/messages/en.json`):
   - Added nav.inactive, projects.emptyInactive, projects.join, projects.leave, projects.leaveConfirm, projects.memberCount/memberCountPlural, projects.joinedAt, projects.alreadyMember, projects.removeConfirm
   - Added projects.invite.searchPlaceholder, noUsersAvailable, loadingUsers
   - Added toasts: joined, joinFailed, left, leaveFailed, memberRemoved, memberRemoveFailed

### Backend APIs required (not yet implemented):
- `GET /api/projects/inactive` -- returns non-archived projects where user is not a member
- `POST /api/projects/[id]/join` -- user joins a project
- `POST /api/projects/[id]/leave` -- user leaves a project (not allowed for owner)
- `GET /api/users/available?projectId=[id]` -- returns users not yet members of the project

## Backend Implementation Notes
**Implemented:** 2026-03-25

### Database Migration (`supabase/migrations/014_project_membership.sql`):
1. **New RLS SELECT policy on `projects`:** "Tenant users can view non-archived projects" -- allows all authenticated tenant users to read non-archived projects (not just members). This enables the "Inaktive Projekte" tab. Existing member-only policy remains for archived projects.
2. **New SECURITY DEFINER function `project_member_count(p_project_id)`:** Returns member count for a project, bypassing RLS. Needed because non-members cannot query `project_members` directly due to existing RLS.
3. **New RLS INSERT policy on `project_members`:** "Users can self-join tenant projects" -- allows users to insert themselves as "member" role into non-archived projects within their tenant.

### API Routes Created:
1. **`GET /api/projects/inactive`** (`src/app/api/projects/inactive/route.ts`):
   - Returns non-archived projects where user is NOT a member, within user's tenant
   - Includes `member_count` via `project_member_count()` RPC
   - Auth check, tenant scoping, limit(100)

2. **`POST /api/projects/[id]/join`** (`src/app/api/projects/[id]/join/route.ts`):
   - User self-joins a project as "member"
   - Validates: UUID param (Zod), auth, tenant, project exists, not archived, not already member
   - Handles unique constraint violation (race condition) with 409 response

3. **`POST /api/projects/[id]/leave`** (`src/app/api/projects/[id]/leave/route.ts`):
   - User removes own membership from project
   - Validates: UUID param (Zod), auth, tenant, project exists, user is member, user is NOT owner
   - Owners get 403 "Projektersteller kann das Projekt nicht verlassen"

4. **`GET /api/users/available?projectId=[id]`** (`src/app/api/users/available/route.ts`):
   - Returns active tenant profiles NOT already members of the specified project
   - Validates: projectId query param (Zod UUID), auth, tenant, project exists
   - Returns: id, display_name, email; ordered by display_name, limit(200)

### Important: Migration must be applied
The migration file `014_project_membership.sql` must be applied to the live Supabase instance before the APIs will work correctly.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
