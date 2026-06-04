# PROJ-30: Status + Datum beim Upload abfragen

## Status: In Review
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

> Implementiert auf Branch `feature/PROJ-27-33-drawings-erweiterungen`.
> Beide Pfade umgesetzt (neue Zeichnung + neue Version); `created_at` überschrieben
> (keine Migration). Automatisierte Prüfungen grün: `tsc`, ESLint, `npm run build`,
> 38/38 Tests. Manuelle Browser-Prüfung + PR-Review ausstehend.

## Beschreibung
Beim Hochladen einer Zeichnung (neu oder als neue Version) sollen Status und Datum
abgefragt werden. Voreinstellung: heutiges Datum und der zuletzt gewählte Status.

## Dependencies
- Requires: PROJ-3 (Upload), PROJ-7 (Versionierung), PROJ-19 (Status pro Version)

## User Stories
- Als **Planer** möchte ich beim Upload direkt Status und (Plan-)Datum setzen, damit der
  Stand der Zeichnung sofort korrekt ist.
- Als **Vielnutzer** möchte ich, dass mein zuletzt gewählter Status vorausgewählt ist, damit
  ich nicht jedes Mal neu klicken muss.

## Acceptance Criteria
- [ ] Im Versions-Upload-Dialog gibt es ein Status-Select und einen Datepicker oberhalb der
      Upload-Zone.
- [ ] Default-Datum = heute; Default-Status = zuletzt gewählter Status (localStorage),
      Fallback = Default-Status des Tenants.
- [ ] Beim Neu-Anlegen mit mehreren Dateien wird Status/Datum **einmal** abgefragt und auf
      alle angewendet.
- [ ] Der gewählte Status wird nach erfolgreichem Upload als „zuletzt gewählt" gespeichert;
      eine veraltete gespeicherte ID wird gegen die aktuelle Status-Liste geprüft.
- [ ] Server übernimmt `status_id` und `created_at`; fehlt der Status, wird der Status der
      bisherigen aktiven Version geerbt.
- [ ] Nur für `canEdit`-Nutzer sichtbar (Schreib-Aktion).

## Edge Cases
- Status-IDs sind tenant-spezifisch → gespeicherte localStorage-ID validieren.
- Datum steuert **nicht** die Versions-Reihenfolge (das bleibt `version_number`).

## Tech Design
- `VersionUploadDialog.tsx`: Status-Select (`useDrawingStatuses`) + Datepicker; State
  `selectedStatusId` / `selectedDate`. `onUpload` um `{ status_id, created_at }` erweitern,
  durch `use-versions.ts` → POST `.../versions` durchreichen.
- Neu-Anlegen: analoger Pre-Upload-Dialog vor dem Storage-Upload in der Projektseite.
- Server: `createVersionSchema` / `createDrawingSchema` um `status_id` (uuid, optional,
  nullable) + `created_at` (datetime, optional) ergänzen; Insert entsprechend.

## Decisions
- **Datum überschreibt `created_at`** (keine neue Spalte, keine Migration).
- Mehrere Dateien beim Neu-Anlegen: einmal abfragen, für alle anwenden.
- „Zuletzt gewählter Status" geräteweit in localStorage.
