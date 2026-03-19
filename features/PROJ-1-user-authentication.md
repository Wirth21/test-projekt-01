# PROJ-1: User Authentication & Team-Konten

## Status: In Review
**Created:** 2026-03-13
**Last Updated:** 2026-03-13

## Dependencies
- None

## Overview
Nutzer können sich registrieren und einloggen. Teams teilen sich gemeinsamen Zugriff auf Projekte. Authentifizierung über Supabase Auth.

## User Stories
- Als neuer Nutzer möchte ich mich mit E-Mail und Passwort registrieren, damit ich die App nutzen kann.
- Als bestehender Nutzer möchte ich mich einloggen, damit ich auf meine Projekte zugreifen kann.
- Als Nutzer möchte ich mich ausloggen, damit mein Konto auf geteilten Geräten sicher ist.
- Als Nutzer möchte ich mein Passwort zurücksetzen können, wenn ich es vergessen habe.
- Als Nutzer möchte ich sehen, welche anderen Teammitglieder in der App registriert sind.

## Acceptance Criteria
- [ ] Nutzer kann sich mit E-Mail + Passwort registrieren (E-Mail-Verifizierung)
- [ ] Nutzer kann sich mit E-Mail + Passwort einloggen
- [ ] Nutzer kann sich ausloggen
- [ ] Passwort-Reset per E-Mail funktioniert
- [ ] Nicht eingeloggte Nutzer werden zur Login-Seite weitergeleitet
- [ ] Eingeloggte Nutzer werden direkt zur Projektübersicht weitergeleitet
- [ ] Fehlermeldungen bei falschem Passwort / unbekannter E-Mail werden angezeigt

## Edge Cases
- Was passiert bei Registrierung mit einer bereits verwendeten E-Mail? → Fehlermeldung "E-Mail bereits vergeben"
- Was passiert bei Login mit falschem Passwort? → Fehlermeldung, kein Hinweis ob E-Mail oder Passwort falsch ist (Sicherheit)
- Was passiert wenn die E-Mail-Verifizierung nicht bestätigt wurde? → Login nicht möglich, Hinweis wird angezeigt
- Was passiert bei Session-Ablauf? → Nutzer wird automatisch zur Login-Seite weitergeleitet
- Was passiert bei zu vielen Fehlversuchen? → Rate-Limiting durch Supabase Auth

## Technical Requirements
- Supabase Auth (Email/Password Provider)
- Geschützte Routen: alle Seiten außer /login und /register erfordern Authentifizierung
- Session wird client-seitig in Supabase gespeichert

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Seitenstruktur (Pages)

```
/login                → Login-Seite (öffentlich)
/register             → Registrierung (öffentlich)
/auth/callback        → E-Mail-Bestätigung (Supabase-Redirect)
/auth/reset-password  → Passwort zurücksetzen

/(protected)/
  /dashboard          → Projektübersicht (geschützt)
  /...                → alle weiteren Seiten (geschützt)
```

### Komponenten-Struktur

```
Layout (Route Guard)
+-- Middleware (prüft Session bei jedem Request)
    +-- Öffentliche Routen → Login/Register-Seiten
    +-- Geschützte Routen → weiterleiten wenn nicht eingeloggt

LoginPage
+-- AuthCard
    +-- Logo / App-Titel
    +-- E-Mail Input
    +-- Passwort Input
    +-- "Einloggen"-Button
    +-- Link → "Passwort vergessen?"
    +-- Link → "Noch kein Konto? Registrieren"
    +-- Fehlermeldung (Alert-Komponente)

RegisterPage
+-- AuthCard
    +-- E-Mail Input
    +-- Passwort Input
    +-- Passwort bestätigen Input
    +-- "Registrieren"-Button
    +-- Erfolgs-Hinweis → "Bitte E-Mail bestätigen"
    +-- Link → "Zurück zum Login"

ResetPasswordPage
+-- AuthCard
    +-- E-Mail Input
    +-- "Link senden"-Button
    +-- Erfolgs-/Fehlermeldung
```

### Datenhaltung

**Was Supabase Auth verwaltet (automatisch):**
- Nutzer-Konto (ID, E-Mail, verifiziert ja/nein)
- Session & Token (gespeichert im Browser, automatisch erneuert)
- E-Mail-Verifizierung & Passwort-Reset (E-Mail-Versand via Supabase)

**Eigene Datenbank-Tabelle `profiles`:**
- Nutzer-ID (verknüpft mit Auth)
- Anzeigename (optional, für Teamübersicht)
- Erstellt-Datum

### Sicherheit & Zugriff (Row Level Security)

- Jeder Nutzer sieht nur sein eigenes Profil + alle anderen Profile (für Teamübersicht)
- Supabase übernimmt Rate-Limiting bei zu vielen Login-Versuchen automatisch
- Next.js Middleware prüft bei jedem Request: eingeloggt? → sonst Redirect zu `/login`

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Auth-Anbieter | Supabase Auth | Bereits im Stack, übernimmt E-Mail-Versand + Session |
| Session-Speicherung | Browser (httpOnly Cookie via Supabase) | Sicherer als localStorage |
| Route-Schutz | Next.js Middleware | Läuft serverseitig, kein Flackern beim Seitenaufruf |
| Formulare | react-hook-form + Zod | Bereits im Stack, typsichere Validierung |

### Abhängigkeiten

- `@supabase/ssr` — Supabase-Client für Next.js mit Middleware-Unterstützung
- `@supabase/supabase-js` — Supabase-Basisbibliothek

Vorhandene shadcn/ui Komponenten (keine neuen nötig): `Input`, `Button`, `Card`, `Alert`, `Form`, `Label`

## Implementation Notes (Frontend)

**Gebaut am:** 2026-03-13

**Erstellt:**
- `src/components/auth/AuthCard.tsx` — Wiederverwendbares Card-Layout für alle Auth-Seiten
- `src/components/auth/LoginForm.tsx` — Login mit react-hook-form + Zod, generische Fehlermeldung
- `src/components/auth/RegisterForm.tsx` — Registrierung mit Passwort-Bestätigung, Erfolgs-State nach signUp
- `src/components/auth/ResetPasswordForm.tsx` — Passwort-Reset ohne E-Mail-Enumeration
- `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/auth/reset-password/page.tsx`
- `src/app/auth/callback/route.ts` — Route Handler für E-Mail-Bestätigung via `exchangeCodeForSession`
- `src/app/(protected)/layout.tsx` — Server-side Auth-Guard (defense-in-depth)
- `src/app/(protected)/dashboard/page.tsx` — Placeholder mit Abmelden-Button
- `middleware.ts` — Route-Schutz für alle Routen; Redirect zu /login bzw. /dashboard
- `src/lib/supabase.ts` — ersetzt durch `createBrowserClient`-Factory
- `src/lib/supabase-server.ts` — neu: `createServerClient` für Server Components

**Abhängigkeiten:**
- `@supabase/ssr` installiert

**Offen vor dem Go-Live:**
- `.env.local` mit echten Supabase-Werten befüllen (URL + Anon Key)
- Supabase-Projekt: Auth-Callback-URL auf `https://<domain>/auth/callback` setzen

## Implementation Notes (Backend)

**Gebaut am:** 2026-03-13

**Datenbank (SQL-Migration):**
- `supabase/migrations/001_profiles.sql` — Vollständige Migration:
  - `profiles`-Tabelle (id, display_name, email, created_at, updated_at)
  - RLS aktiviert mit Policies: SELECT (alle auth. Nutzer), INSERT/UPDATE (nur eigenes Profil), DELETE verweigert
  - Indexes auf `email` und `created_at`
  - `handle_updated_at()` Trigger für automatische `updated_at`-Pflege
  - `handle_new_user()` Trigger auf `auth.users` INSERT: erstellt automatisch ein Profil bei Registrierung

**API-Routen:**
- `GET /api/profile` — Eigenes Profil laden (auth-geschützt)
- `PUT /api/profile` — Eigenes Profil aktualisieren mit Zod-Validierung (display_name)
- `GET /api/profiles` — Alle Team-Profile laden (auth-geschützt, für Teamübersicht)

**Validierung:**
- `src/lib/validations/profile.ts` — Zod-Schemas für Profil-Update und Passwort-Update

**Update-Password-Seite:**
- `src/app/auth/update-password/page.tsx` — Seite zum Setzen eines neuen Passworts
- `src/components/auth/UpdatePasswordForm.tsx` — Formular mit Zod-Validierung (min 8 Zeichen, Bestätigung)
- Passwort-Reset-Flow: ResetPasswordForm -> E-Mail -> /auth/callback -> /auth/update-password

**Offen vor dem Go-Live:**
- SQL-Migration in Supabase SQL Editor ausführen
- E-Mail-Templates in Supabase konfigurieren (Redirect-URL für Recovery)

## QA Test Results

### QA Round 1 (2026-03-13) -- Static Code Review

**Bugs Found:** 7 total (1 critical, 2 high, 2 medium, 2 low)
**Production Ready:** NO

---

### QA Round 2 (2026-03-16) -- Re-test After Fixes

**Tested:** 2026-03-16
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code review of all implementation files + build verification
**Build Status:** PASS -- `npm run build` compiles successfully with no errors (Next.js 16.1.6 Turbopack)

### Acceptance Criteria Status

#### AC-1: Nutzer kann sich mit E-Mail + Passwort registrieren (E-Mail-Verifizierung) -- PASS
- [x] RegisterForm uses Zod schema with email validation and min 8 char password
- [x] Password confirmation field with `.refine()` mismatch validation
- [x] Calls `supabase.auth.signUp()` correctly
- [x] Shows success message after registration asking user to confirm email
- [x] Uses `autoComplete="new-password"` for accessibility

#### AC-2: Nutzer kann sich mit E-Mail + Passwort einloggen -- PASS
- [x] LoginForm uses Zod schema with email + password validation
- [x] Calls `supabase.auth.signInWithPassword()` correctly
- [x] Redirects to `/dashboard` on success via `router.push` + `router.refresh`
- [x] Uses `autoComplete="email"` and `autoComplete="current-password"`

#### AC-3: Nutzer kann sich ausloggen -- PASS
- [x] Dashboard page has "Abmelden" button with LogOut icon
- [x] Calls `supabase.auth.signOut()` correctly
- [x] Redirects to `/login` after logout via `router.push` + `router.refresh`

#### AC-4: Passwort-Reset per E-Mail funktioniert -- PASS
- [x] ResetPasswordForm calls `supabase.auth.resetPasswordForEmail()`
- [x] Uses `redirectTo` with `/auth/callback?next=/auth/update-password`
- [x] Shows generic success message (no email enumeration)
- [x] UpdatePasswordForm calls `supabase.auth.updateUser({ password })` with Zod validation
- [x] Auth callback route exchanges code for session, then redirects to update-password

#### AC-5: Nicht eingeloggte Nutzer werden zur Login-Seite weitergeleitet -- PASS
- [x] Middleware checks `supabase.auth.getUser()` and redirects to `/login` if no user
- [x] Protected layout (`(protected)/layout.tsx`) has defense-in-depth server-side check
- [x] Root page (`/`) redirects to `/login`

#### AC-6: Eingeloggte Nutzer werden direkt zur Projektubersicht weitergeleitet -- PASS
- [x] Middleware redirects authenticated users from `/login` and `/register` to `/dashboard`

#### AC-7: Fehlermeldungen bei falschem Passwort / unbekannter E-Mail werden angezeigt -- PASS
- [x] LoginForm shows generic "E-Mail oder Passwort ist nicht korrekt." (no enumeration)
- [x] Alert with `variant="destructive"` used for error display

### Edge Cases Status

#### EC-1: Registrierung mit bereits verwendeter E-Mail -- PASS (fixed since Round 1)
- [x] RegisterForm checks `authError.message` for "already registered" string
- [x] RegisterForm also checks `data.user?.identities?.length === 0` for Supabase fake-success scenario (line 69 of RegisterForm.tsx)
- [x] Both cases show "Diese E-Mail-Adresse ist bereits vergeben."

#### EC-2: Login mit falschem Passwort -- PASS
- [x] Generic error message shown, no hint whether email or password is wrong

#### EC-3: E-Mail-Verifizierung nicht bestatigt -- PASS (fixed since Round 1)
- [x] LoginForm checks `authError.code === "email_not_confirmed"` (line 54 of LoginForm.tsx)
- [x] Shows specific message: "E-Mail-Adresse noch nicht bestatigt. Bitte prufe deinen Posteingang und klicke auf den Bestatigungslink."

#### EC-4: Session-Ablauf -- PASS
- [x] Middleware runs on every request and checks `getUser()`, which verifies the JWT server-side
- [x] Supabase SSR handles automatic token refresh via cookie management in middleware

#### EC-5: Rate-Limiting bei zu vielen Fehlversuchen -- PASS
- [x] Delegated to Supabase Auth (built-in rate limiting)
- [x] No custom rate limiting needed per spec

### Security Audit Results

#### Authentication
- [x] Middleware uses `getUser()` (server-side verification) instead of `getSession()` (client-side, spoofable)
- [x] Protected layout has defense-in-depth with additional server-side auth check
- [x] Auth callback properly exchanges code for session server-side

#### Authorization
- [x] API routes (`/api/profile`, `/api/profiles`) verify auth via `getUser()` before processing
- [x] RLS policies restrict INSERT/UPDATE to own profile only
- [x] DELETE policy intentionally missing (denied by default with RLS)
- [x] Profile update uses `user.id` from server-side auth, not from request body

#### Input Validation
- [x] Client-side: Zod schemas validate email format, password length, confirmation match
- [x] Server-side: `/api/profile` PUT uses `updateProfileSchema.safeParse()` with Zod
- [x] `display_name` field trimmed and limited to 100 characters
- [x] Password schema enforces min 8, max 128 characters

#### Open Redirect -- PASS (fixed since Round 1)
- [x] Auth callback route validates `next` parameter: must start with `/` AND must not start with `//` (line 10-13 of callback/route.ts)
- [x] Falls back to `/dashboard` if validation fails
- [x] Redirect uses `${origin}${next}` which constrains to same origin

#### Secrets & Environment -- PASS (fixed since Round 1)
- [x] `.env*.local` is in `.gitignore` -- secrets will not be committed
- [x] `.env.local.example` now contains clearly dummy placeholder values (`your-project-id.supabase.co`, `your-anon-key-here`)

#### Security Headers -- PASS (fixed since Round 1)
- [x] `next.config.ts` now configures comprehensive security headers:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  - Permissions-Policy: camera=(), microphone=(), geolocation=()
  - Content-Security-Policy with restrictive policy including connect-src for Supabase

#### XSS Prevention
- [x] React/Next.js provides built-in XSS protection via JSX escaping
- [x] No use of `dangerouslySetInnerHTML`
- [x] Form inputs are controlled via react-hook-form

#### CSRF
- [x] Supabase SSR uses httpOnly cookies with SameSite protection
- [x] API routes use server-side auth verification

#### Email Enumeration
- [x] Login: generic error message "E-Mail oder Passwort ist nicht korrekt"
- [x] Reset password: generic success message regardless of whether email exists
- [x] Register: now properly handles both error and fake-success scenarios for duplicate emails

#### CSP Assessment (new in Round 2)
- [ ] NOTE: CSP includes `'unsafe-eval'` and `'unsafe-inline'` for script-src. The `'unsafe-eval'` is documented as "needed for Next.js dev" but should be removed in production builds if possible. See BUG-8.

### Cross-Browser Assessment (Code Review)
- [x] No browser-specific APIs used; standard React/Next.js patterns
- [x] `window.location.origin` used in ResetPasswordForm (available in all modern browsers)
- [x] No CSS features that would break cross-browser compatibility
- [x] `autoComplete` attributes set correctly for password managers
- [x] Standard Tailwind CSS utilities -- no vendor-specific prefixes needed

### Responsive Assessment (Code Review)
- [x] AuthCard uses `min-h-screen flex items-center justify-center` for centering
- [x] Card max-width set to 400px with `w-full` and `px-4` padding -- works at 375px
- [x] Dashboard header uses `flex items-center justify-between` with responsive `max-w-6xl mx-auto px-4` padding
- [x] Project grid uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` breakpoints
- [x] No fixed widths that would break on mobile
- [x] Tailwind CSS responsive utilities used throughout

### Bugs Found (Round 2)

#### Previously Found Bugs -- Status

| Bug | Severity | Round 1 Status | Round 2 Status |
|-----|----------|---------------|---------------|
| BUG-1: Duplicate email false success | Medium | Open | FIXED -- RegisterForm checks `identities.length === 0` |
| BUG-2: No hint for unverified email | Medium | Open | FIXED -- LoginForm checks `authError.code === "email_not_confirmed"` |
| BUG-3: Open redirect in auth callback | High | Open | FIXED -- Validates `next` starts with `/` and not `//` |
| BUG-4: Real credentials in .env.local.example | Critical | Open | FIXED -- Now uses dummy placeholder values |
| BUG-5: Missing security headers | High | Open | FIXED -- Comprehensive headers in next.config.ts |
| BUG-6: Root double redirect | Low | Open | OPEN -- Still present, low priority |
| BUG-7: Login button navigation error handling | Low | Open | OPEN -- Still present, low priority |

#### BUG-6: Root Page Redirects to /login Instead of Handling Auth State (STILL OPEN)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Be logged in
  2. Navigate to `/` (root)
  3. Expected: Redirect to `/dashboard` since the user is already authenticated
  4. Actual: `src/app/page.tsx` does a hard `redirect("/login")`, which then gets redirected again to `/dashboard` by the middleware. This causes a double redirect (/ -> /login -> /dashboard) which adds latency
- **Priority:** Nice to have

#### BUG-7: Login Button Navigation Error Handling (STILL OPEN)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Go to `/login`
  2. Enter valid credentials and submit
  3. If `router.push("/dashboard")` fails for any reason (network issue, etc.), the button stays in loading state forever with no error feedback
  4. Expected: Error handling or timeout for failed navigation
  5. Actual: No catch around `router.push` / `router.refresh` calls
- **Priority:** Nice to have

#### BUG-8: CSP Uses unsafe-eval and unsafe-inline (NEW)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Open `next.config.ts`
  2. Observe `script-src 'self' 'unsafe-eval' 'unsafe-inline'` in CSP
  3. Expected: Production CSP should avoid `'unsafe-eval'` to prevent eval-based XSS attacks
  4. Actual: `'unsafe-eval'` is included with a comment "needed for Next.js dev" but is applied to all environments including production. This weakens XSS protection significantly
- **Priority:** Fix before production deployment -- consider using nonce-based CSP or removing `'unsafe-eval'` for production builds

#### BUG-9: handle_new_user Trigger Uses SECURITY DEFINER Without search_path Restriction (NEW)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Open `supabase/migrations/001_profiles.sql`
  2. Observe `handle_new_user()` function is created with `SECURITY DEFINER`
  3. Expected: Functions with `SECURITY DEFINER` should set `search_path = ''` or `search_path = public` to prevent search_path injection attacks
  4. Actual: No `SET search_path` clause. A malicious actor who can modify the `search_path` could potentially hijack the function execution
- **Priority:** Fix before deployment -- add `SET search_path = public` to the function definition

#### BUG-10: API Routes Missing HTTP Method Restrictions (NEW)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send a POST request to `GET /api/profiles`
  2. Expected: 405 Method Not Allowed response
  3. Actual: Next.js App Router only exports `GET`, so unsupported methods should return 405 automatically. However, this should be verified at runtime. The routes themselves are correctly structured with only the intended HTTP methods exported
- **Priority:** Nice to have -- verify at runtime

### Summary
- **Acceptance Criteria:** 7/7 passed
- **Edge Cases:** 5/5 passed (2 fixed since Round 1)
- **Previously Found Bugs:** 5/7 fixed (BUG-1 through BUG-5 all resolved), 2 low-severity remain open
- **New Bugs Found:** 3 (0 critical, 0 high, 2 medium, 1 low)
- **Total Open Bugs:** 5 (0 critical, 0 high, 2 medium, 3 low)
- **Security:** Significantly improved since Round 1. All critical and high-severity issues resolved. CSP and SQL SECURITY DEFINER are medium-severity hardening items.
- **Production Ready:** YES (conditional)
- **Recommendation:** The feature is production-ready with the caveat that BUG-8 (CSP unsafe-eval) and BUG-9 (SECURITY DEFINER search_path) should be addressed before going to a production environment with real user data. The remaining low-severity bugs (BUG-6, BUG-7, BUG-10) can be deferred to a future sprint.

## Deployment
_To be added by /deploy_
