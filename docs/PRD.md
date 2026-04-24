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
| P0 (MVP) | User Authentication & Team-Konten | Done |
| P0 (MVP) | Projektverwaltung | Done |
| P0 (MVP) | PDF Upload & Viewer | Done |
| P0 (MVP) | Marker-System mit Navigation | Done |
| P1 | Admin-Bereich (Nutzer, Rollen, Status) | Done |
| P1 | Archivierungssystem (Projekte & Zeichnungen) | Done |
| P1 | PDF-Versionierung | Done |
| P1 | Zeichnungsgruppen | Done |
| P1 | Änderungsprotokoll (Audit Log) | Done |
| P1 | PDF Vollbildansicht | Done |
| P1 | Projektmitgliedschaft & Selbstverwaltung | Done |
| P1 | Mobile Optimierung (Responsive) | Done |
| P2 | Zeichnungsstatus pro Version | Done |
| P2 | Rollen: Viewer & Guest | Done |
| P2 | PWA & Android-Installation | Done |
| P2 | Sentry Error Tracking | Done |
| P2 | Branding (Logo, Favicon, Impressum) | Done |
| P1 | Offline-First Caching & Synchronisation | Done |
| P1 | Admin Projekt-Hard-Delete | Done |

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
- ~~Kein Offline-Modus~~ (jetzt als PROJ-24 implementiert — Phase 1: Offline-Lesen)

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
