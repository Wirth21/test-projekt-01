# PROJ-15: Änderungsprotokoll (Audit Log)

## Status: In Review
**Created:** 2026-03-25
**Last Updated:** 2026-03-25

## Dependencies
- Requires: PROJ-1 (User Authentication) -- Nutzer-Identifikation für Protokolleinträge
- Requires: PROJ-2 (Projektverwaltung) -- Projekte als Kontext für Änderungen
- Requires: PROJ-3 (PDF Upload & Viewer) -- Zeichnungen als protokollierte Objekte
- Requires: PROJ-7 (PDF-Versionierung) -- Versionserstellung wird protokolliert

## Overview
Alle relevanten Aktionen innerhalb eines Projekts werden automatisch in einem Änderungsprotokoll festgehalten. Das Protokoll zeigt, wer wann welche Aktion durchgeführt hat (z.B. PDF hochgeladen, Version erstellt, Zeichnung archiviert, Mitglied eingeladen). Pro Projekt gibt es eine chronologische Änderungshistorie, die für alle Projektmitglieder einsehbar ist.

## User Stories
- Als Projektmitglied möchte ich sehen, wer eine bestimmte PDF hochgeladen hat, damit ich bei Fragen den richtigen Ansprechpartner finde.
- Als Projektmitglied möchte ich nachvollziehen, wann und von wem Dateien geändert (umbenannt, archiviert, neue Version) wurden, damit ich Änderungen zeitlich einordnen kann.
- Als Projektmitglied möchte ich ein chronologisches Änderungslog pro Projekt einsehen, damit ich auf einen Blick sehe, was zuletzt passiert ist.
- Als Projektersteller möchte ich sehen, wer Mitglieder eingeladen oder entfernt hat, damit ich die Teamzusammensetzung nachvollziehen kann.
- Als Admin möchte ich projektübergreifend Aktivitäten einsehen können, um bei Problemen nachforschen zu können.

## Acceptance Criteria

### Protokollierte Aktionen
- [ ] Zeichnung hochgeladen (Wer, Dateiname, Zeitpunkt)
- [ ] Zeichnung umbenannt (Wer, alter Name, neuer Name, Zeitpunkt)
- [ ] Zeichnung archiviert (Wer, Dateiname, Zeitpunkt)
- [ ] Zeichnung wiederhergestellt (Wer, Dateiname, Zeitpunkt)
- [ ] Neue Version hochgeladen (Wer, Zeichnungsname, Versionsnummer, Zeitpunkt)
- [ ] Version archiviert (Wer, Zeichnungsname, Versionsnummer, Zeitpunkt)
- [ ] Projekt erstellt (Wer, Projektname, Zeitpunkt)
- [ ] Projekt umbenannt/bearbeitet (Wer, alter Name, neuer Name, Zeitpunkt)
- [ ] Projekt archiviert/wiederhergestellt (Wer, Zeitpunkt)
- [ ] Mitglied eingeladen (Wer hat wen eingeladen, Zeitpunkt)
- [ ] Mitglied entfernt (Wer hat wen entfernt, Zeitpunkt)
- [ ] Marker erstellt/gelöscht (Wer, Zeichnungsname, Zeitpunkt)

### Anzeige im Projekt
- [ ] In der Projektdetailseite gibt es einen Bereich/Tab "Änderungsprotokoll"
- [ ] Einträge werden chronologisch angezeigt (neueste zuerst)
- [ ] Jeder Eintrag zeigt: Nutzer (Name), Aktion (lesbare Beschreibung), Zeitpunkt (relativ, z.B. "vor 2 Stunden")
- [ ] Das Protokoll ist paginiert oder per "Mehr laden" erweiterbar (max. 50 Einträge pro Seite)
- [ ] Alle Projektmitglieder können das Protokoll einsehen (lesend)

### Anzeige pro Zeichnung
- [ ] Im Viewer oder in der Zeichnungsdetailansicht wird angezeigt, wer die Zeichnung hochgeladen hat und wann
- [ ] Letzte Änderung (z.B. "Umbenannt von Max Mustermann am 25.03.2026") ist sichtbar

### Filterung
- [ ] Protokoll kann nach Aktionstyp gefiltert werden (z.B. nur Uploads, nur Mitglieder-Änderungen)
- [ ] Protokoll kann nach Nutzer gefiltert werden

## Edge Cases
- Was passiert, wenn der Nutzer, der die Aktion durchgeführt hat, gelöscht/deaktiviert wurde? -> Anzeige als "Gelöschter Nutzer" oder mit gespeichertem Namen zum Zeitpunkt der Aktion
- Was passiert bei sehr vielen Einträgen (>1000)? -> Paginierung; ältere Einträge bleiben in der DB erhalten
- Was passiert, wenn eine Aktion fehlschlägt (z.B. Upload-Fehler)? -> Kein Protokolleintrag wird erstellt (nur erfolgreiche Aktionen werden protokolliert)
- Was passiert, wenn ein Admin eine Aktion durchführt? -> Wird als Admin-Aktion protokolliert (gleiche Darstellung, aber Nutzer ist der Admin)
- Sollen Marker-Aktionen protokolliert werden? -> Ja, aber nur Erstellen und Löschen (nicht Verschieben/Bearbeiten, um Spam zu vermeiden)

## Technical Requirements
- Neue Datenbanktabelle `activity_log` mit: id, project_id (FK), user_id (FK), action_type (enum), target_type (z.B. 'drawing', 'version', 'member', 'project'), target_id (UUID), metadata (JSONB -- enthält Details wie alter/neuer Name), created_at
- RLS: Nur Projektmitglieder können das Protokoll ihres Projekts lesen; Admins können alle lesen
- Kein DELETE erlaubt -- Protokolleinträge sind unveränderbar (Audit-Anforderung)
- Protokollierung erfolgt serverseitig in den bestehenden API-Routen (kein separater Service)
- `user_id` speichert die User-ID zum Zeitpunkt der Aktion; zusätzlich wird `user_name` als Snapshot in metadata gespeichert (für den Fall, dass der Nutzer später gelöscht wird)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
**Erstellt:** 2026-03-25

### Wichtiger Hinweis
PROJ-15 erfordert sowohl Backend (neue Datenbanktabelle + Logging in bestehenden API-Routen) als auch Frontend (Anzeige-Komponenten). Die Protokollierung wird in die bestehenden API-Routen integriert -- kein separater Logging-Service.

---

### Komponenten-Struktur

```
Projektdetailseite /dashboard/projects/[id]
+-- Zeichnungen-Bereich (bestehend)
+-- Mitglieder-Bereich (bestehend)
+-- Änderungsprotokoll-Bereich (NEU -- ganz unten oder als Tab)
    +-- ActivityLogHeader
    |   +-- Titel "Änderungsprotokoll"
    |   +-- FilterBar (NEU)
    |       +-- Aktionstyp-Filter (Dropdown: Alle, Uploads, Mitglieder, Marker...)
    |       +-- Nutzer-Filter (Dropdown: Alle Nutzer, Nutzer X...)
    +-- ActivityLogList
    |   +-- ActivityLogEntry[] (chronologisch, neueste zuerst)
    |   |   +-- Avatar/Icon (je nach Aktionstyp)
    |   |   +-- Beschreibung ("Max hat 'Grundriss.pdf' hochgeladen")
    |   |   +-- Zeitstempel (relativ: "vor 2 Stunden")
    |   +-- LoadMoreButton ("Weitere Einträge laden")

Viewer-Seite /dashboard/projects/[id]/drawings/[drawingId]
+-- Header (bestehend)
    +-- Upload-Info (NEU -- dezent)
        +-- "Hochgeladen von Max am 15.03.2026"
```

### Datenmodell

**Neue Tabelle `activity_log`:**
- Jeder Eintrag hat: Eindeutige ID, Projekt-Referenz, Nutzer-Referenz, Aktionstyp (z.B. "drawing.uploaded", "member.invited"), Ziel-Typ (z.B. "drawing", "version", "member"), Ziel-ID, Metadaten (flexible Zusatzdaten wie alter/neuer Name, Dateiname), Erstellungszeitpunkt
- Metadaten als flexibler JSON-Speicher: enthält kontextabhängige Details (z.B. `{ "display_name": "Grundriss.pdf", "file_size": 1234567 }` bei Upload, oder `{ "old_name": "Alt", "new_name": "Neu" }` bei Umbenennung)
- Nutzer-Name wird als Snapshot in den Metadaten gespeichert, damit der Name auch nach Löschung des Nutzers sichtbar bleibt

**Keine Änderungen an bestehenden Tabellen.**

### Aktionstypen

| Aktionstyp | Ziel-Typ | Metadaten |
|---|---|---|
| drawing.uploaded | drawing | display_name, file_size |
| drawing.renamed | drawing | old_name, new_name |
| drawing.archived | drawing | display_name |
| drawing.restored | drawing | display_name |
| version.uploaded | version | drawing_name, version_number |
| version.archived | version | drawing_name, version_number |
| project.created | project | name |
| project.updated | project | old_name, new_name |
| project.archived | project | name |
| project.restored | project | name |
| member.invited | member | invited_email, invited_name |
| member.removed | member | removed_email, removed_name |
| marker.created | marker | marker_name, drawing_name |
| marker.deleted | marker | marker_name, drawing_name |

### API-Routen

- `GET /api/projects/[id]/activity` -- Protokolleinträge laden mit Paginierung (`?page=1&limit=50`), optionale Filter (`?action_type=drawing.uploaded&user_id=xxx`)
- Kein POST/PUT/DELETE -- Einträge werden nur intern von bestehenden API-Routen erstellt

### Integration in bestehende Routen

Die Protokollierung wird als serverseitige Hilfsfunktion (`logActivity(projectId, userId, actionType, targetType, targetId, metadata)`) implementiert und in den bestehenden API-Routen aufgerufen -- jeweils NACH der erfolgreichen Aktion (damit fehlgeschlagene Aktionen nicht protokolliert werden).

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Speicher | Datenbanktabelle (nicht externer Service) | Einfach, konsistent, RLS-geschützt |
| Protokollierung | In API-Routen (serverseitig) | Zuverlässig; keine clientseitigen Lücken |
| Metadaten | Flexibles JSON-Feld | Verschiedene Aktionen haben unterschiedliche Kontextdaten |
| Nutzer-Snapshot | Name in Metadaten | Protokoll bleibt lesbar auch wenn Nutzer gelöscht wird |
| Paginierung | Cursor/Offset-basiert (50 pro Seite) | Performant bei großen Protokollen |
| Unveränderbarkeit | Kein UPDATE/DELETE RLS | Audit-Anforderung: Protokoll darf nicht manipuliert werden |

### Neue Abhängigkeiten

Keine -- alle Funktionalität nutzt bestehende Supabase-Tabellen und shadcn/ui-Komponenten.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
