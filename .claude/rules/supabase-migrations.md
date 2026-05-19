# Supabase Migration Rules

Diese Regeln gelten für **jede** neue SQL-Migration, die du an die Supabase-Instanz anwendest.

## Stichtag: 30. Oktober 2026

Ab diesem Datum erzwingt Supabase, dass Tabellen im `public`-Schema **explizite GRANTs** für die API-Rollen brauchen, sonst sind sie über supabase-js / PostgREST / GraphQL **nicht erreichbar** (Fehler `42501`). Ab dem **30. Mai 2026** gilt das bereits für alle neu erstellten Supabase-Projekte (z. B. Staging-Klone, Branch-DBs).

Quelle: https://supabase.com/docs/guides/api/securing-your-api

## Pflicht-Pattern für neue Tabellen

Jede `CREATE TABLE public.xxx` muss von folgendem Block gefolgt sein:

```sql
-- 1) Tabelle anlegen
create table public.your_table (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- ...
  created_at timestamptz not null default now()
);

-- 2) GRANTs für Data-API-Rollen (Pflicht ab Oct 2026)
grant select on public.your_table to anon;
grant select, insert, update, delete on public.your_table to authenticated;
grant all on public.your_table to service_role;

-- 3) RLS einschalten
alter table public.your_table enable row level security;

-- 4) RLS-Policies — IMMER auth.uid() als (select auth.uid()) wickeln
--    (siehe Memory feedback_rls_auth_uid_init)
create policy "user can read own rows"
  on public.your_table
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
```

### Welche GRANTs für welche Rolle?

| Rolle | Default-Empfehlung | Wann anders |
|---|---|---|
| `anon` | meist gar nichts — Link2plan hat keine öffentlichen Tabellen | nur für Landing-Page / öffentliche Daten |
| `authenticated` | `select, insert, update, delete` | bei reinen Read-only-Tabellen nur `select` |
| `service_role` | `all` | immer voller Zugriff |

**Wichtig:** `anon` braucht in Link2plan praktisch nie Schreibrechte. Wenn du dir unsicher bist, lass `anon` weg und gib der Tabelle nur `authenticated` + `service_role`.

## Wenn du eine bestehende Tabelle änderst

`ALTER TABLE` / `CREATE INDEX` / Spaltenänderungen brauchen **keine** neuen GRANTs — die existierenden Grants bleiben erhalten.

Nur bei `CREATE TABLE` und beim Anlegen von Views/MatViews musst du GRANT mitschreiben.

## Funktionen (RPCs)

Für `CREATE FUNCTION`:
- Immer `SET search_path = public, pg_temp` (siehe [[feedback_function_search_path]])
- Wenn die Funktion **nicht** über `/rest/v1/rpc/` aufrufbar sein soll (z. B. Trigger-Funktion, interne Helper), zusätzlich:
  ```sql
  revoke execute on function public.your_fn() from anon, authenticated;
  ```
- Wenn sie aufrufbar sein **soll** (z. B. `is_admin`, `is_project_member`), nichts extra tun — der Default ist `EXECUTE` für alle Rollen.

## Workflow

1. Migration als SQL-Datei in `supabase/migrations/` schreiben
2. Über `mcp__supabase__apply_migration` an die Live-Instanz anwenden (siehe [[feedback_apply_migrations]])
3. Nach DDL-Änderungen `get_advisors` (security) laufen lassen, um neue Warnings zu fangen
4. Bei Tabellen-Anlage: kurz mit `select` als `authenticated`-User testen, dass die App noch lesen kann

## Verifikation

Nach jedem `apply_migration` mit neuer Tabelle:
```sql
-- Sollte mindestens 'authenticated' und 'service_role' zurückgeben
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'your_table';
```

Kommt da nichts zurück, fehlen die GRANTs und die Tabelle wird ab Oct 30, 2026 unsichtbar für supabase-js.
