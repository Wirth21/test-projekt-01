# Product Requirements Document

## Vision
Ein webbasiertes Team-Tool zur Verwaltung technischer PDF-Pläne (z.B. Baupläne, Grundrisse, Schaltpläne). Teams können Projekte anlegen, PDFs hochladen und intelligente Marker setzen, die als klickbare Links zwischen Dokumenten fungieren — mit Hover-Vorschau und Navigationshistorie.

## Target Users
**Primäre Nutzer:** Techniker, Planer, Architekten und Ingenieure, die mit umfangreichen Planunterlagen arbeiten.
- **Pain Points:** PDFs liegen unstrukturiert verteilt vor. Verweise zwischen Plänen (z.B. "Details in Zeichnung X") müssen manuell gesucht werden. Keine schnelle Navigation zwischen verknüpften Dokumenten im Team.
- **Bedürfnisse:** Zentrale Ablage von Plandokumenten, schnelle Navigation zwischen verknüpften PDFs, Teamzugriff auf gemeinsame Projekte.

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | User Authentication & Team-Konten | Planned |
| P0 (MVP) | Projektverwaltung | Planned |
| P0 (MVP) | PDF Upload & Viewer | Planned |
| P0 (MVP) | Marker-System mit Navigation | Planned |
| P1 | Admin-Bereich (Nutzerfreigaben & Projektzugriffe) | Planned |
| P1 | Archivierungssystem (Projekte & Zeichnungen, kein Löschen) | Planned |
| P1 | PDF-Versionierung | In Review |
| P1 | Zeichnungsgruppen | In Review |

## Success Metrics
- Teams können Projekte mit PDFs anlegen und gemeinsam nutzen
- Nutzer können Marker auf PDFs platzieren und zwischen Dokumenten navigieren
- Navigationshistorie ermöglicht schnelles Zurückspringen in der Dokumentenkette
- PDFs laden zuverlässig im Browser ohne externe Software

## Constraints
- Web-App (Browser-basiert), kein Desktop-Client
- PDFs werden in Supabase Storage gespeichert
- Marker-Links gelten nur innerhalb eines Projekts (keine projektübergreifenden Links)

## Non-Goals
- Keine Bearbeitung/Annotation von PDF-Inhalten (nur lesend mit Markern)
- ~~Keine Versionierung von PDFs in V1~~ (jetzt als PROJ-7 implementiert)
- Keine öffentlichen/externen Freigabe-Links in V1
- Kein Offline-Modus

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
