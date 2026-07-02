// Branchenspezifische SEO-Landing-Pages ("Use Cases").
// Deutschsprachig, da Zielmarkt DACH und der i18n-Default "de" ist —
// ein Crawler ohne locale-Cookie erhält automatisch diese Seiten.

export interface UseCaseItem {
  title: string;
  description: string;
}

export interface UseCase {
  slug: string;
  /** kurzes Label für Navigation/Footer */
  shortLabel: string;
  /** <title> — keyword-orientiert, ~55–60 Zeichen ideal */
  metaTitle: string;
  /** meta description — ~150 Zeichen */
  metaDescription: string;
  /** kleines Label über der H1 */
  eyebrow: string;
  h1: string;
  heroSubtitle: string;
  problemTitle: string;
  problems: UseCaseItem[];
  solutionTitle: string;
  solutions: UseCaseItem[];
  steps: UseCaseItem[];
  faq: { question: string; answer: string }[];
  ctaTitle: string;
  ctaSubtitle: string;
}

export const useCases: UseCase[] = [
  {
    slug: "elektroplanung",
    shortLabel: "Elektroplanung",
    metaTitle: "Schalt- & Elektropläne verwalten und verknüpfen | Link2plan",
    metaDescription:
      "Elektropläne, Schalt- und Stromlaufpläne zentral ablegen und per Marker verknüpfen. Dein Team navigiert per Klick zwischen den Plänen — im Browser, ohne Suchen.",
    eyebrow: "Für Elektroplaner & Elektrotechnik",
    h1: "Schalt- und Elektropläne verwalten, die zusammengehören",
    heroSubtitle:
      "Stromlaufpläne, Klemmenpläne und Übersichten liegen selten am selben Ort. Mit Link2plan verknüpfst du zusammengehörige Elektropläne per Marker und springst per Klick von der Übersicht ins Detail.",
    problemTitle: "Kennst du das?",
    problems: [
      {
        title: "Verweise ins Leere",
        description:
          "„Siehe Schaltschrank S3“ steht im Plan — aber welches PDF, welche Seite? Die Suche kostet jedes Mal Minuten.",
      },
      {
        title: "Pläne verteilt auf Ordner & Mails",
        description:
          "Stromlaufplan hier, Klemmenplan dort, die Revision im Postfach. Niemand weiß sicher, welche Version aktuell ist.",
      },
      {
        title: "Kein gemeinsamer Zugriff",
        description:
          "Der Kollege auf der Baustelle sieht nicht denselben Planstand wie das Büro.",
      },
    ],
    solutionTitle: "So löst Link2plan das",
    solutions: [
      {
        title: "Marker statt Textverweise",
        description:
          "Setze einen klickbaren Marker genau dort, wo der Plan auf einen anderen verweist — ein Klick, und der Zielplan öffnet sich.",
      },
      {
        title: "Alle Elektropläne an einem Ort",
        description:
          "Lade Stromlauf-, Klemmen- und Übersichtspläne als PDF in ein Projekt. Zentral, versioniert und für das ganze Team sichtbar.",
      },
      {
        title: "Hover-Vorschau",
        description:
          "Fahre über einen Marker und sieh sofort, wohin er führt — ohne den aktuellen Plan zu verlassen.",
      },
      {
        title: "Revisionen ohne Datenverlust",
        description:
          "Lade eine neue Version hoch — die Marker bleiben erhalten, ältere Stände ebenfalls.",
      },
    ],
    steps: [
      {
        title: "Projekt anlegen & PDFs hochladen",
        description:
          "Leg ein Projekt an und lade deine Elektropläne als PDF hoch — direkt im Browser.",
      },
      {
        title: "Marker auf Verweise setzen",
        description:
          "Markiere die Stellen, die auf andere Pläne verweisen, und verknüpfe sie per Klick.",
      },
      {
        title: "Im Team navigieren",
        description:
          "Alle im Projekt springen per Klick zwischen den Plänen — mit voller Navigationshistorie.",
      },
    ],
    faq: [
      {
        question: "Kann ich Stromlaufpläne als PDF hochladen?",
        answer:
          "Ja. Link2plan zeigt PDF-Pläne direkt im Browser an — ganz ohne CAD- oder Zusatzsoftware.",
      },
      {
        question: "Funktioniert das auch auf der Baustelle am Handy?",
        answer:
          "Ja. Link2plan läuft im Browser und lässt sich als App (PWA) installieren, auch für die mobile Nutzung.",
      },
      {
        question: "Bleiben Marker bei einer neuen Revision erhalten?",
        answer:
          "Ja. Beim Hochladen einer neuen PDF-Version werden bestehende Marker automatisch übernommen.",
      },
    ],
    ctaTitle: "Bring Ordnung in deine Elektropläne",
    ctaSubtitle: "Kostenlos starten — keine Kreditkarte, keine Installation.",
  },
  {
    slug: "architektur-planungsbueros",
    shortLabel: "Architektur & Planung",
    metaTitle: "Baupläne verwalten: Grundrisse & Details verlinken | Link2plan",
    metaDescription:
      "Baupläne, Grundrisse, Schnitte und Detailzeichnungen zentral verwalten und per Marker verlinken. Das ganze Büro navigiert per Klick durch die Planunterlagen.",
    eyebrow: "Für Architektur- & Planungsbüros",
    h1: "Baupläne verwalten, ohne im Ordner-Chaos zu suchen",
    heroSubtitle:
      "Grundrisse, Schnitte, Ansichten und Details gehören zusammen — liegen aber oft verstreut. Mit Link2plan verknüpfst du Zeichnungen per Marker und dein Büro findet jedes Detail per Klick.",
    problemTitle: "Kennst du das?",
    problems: [
      {
        title: "„Details siehe Zeichnung 12“",
        description:
          "Solche Verweise muss heute jeder manuell nachschlagen. Bei Dutzenden Plänen kostet das Zeit und Nerven.",
      },
      {
        title: "Planstände driften auseinander",
        description:
          "Wer hat die aktuelle Version? Ausgedruckte und gemailte PDFs führen zu Missverständnissen.",
      },
      {
        title: "Neue Mitarbeiter finden sich nicht zurecht",
        description:
          "Ohne klare Struktur dauert die Einarbeitung in ein Projekt unnötig lange.",
      },
    ],
    solutionTitle: "So löst Link2plan das",
    solutions: [
      {
        title: "Grundriss ↔ Detail per Marker",
        description:
          "Verknüpfe einen Bereich im Grundriss mit der zugehörigen Detailzeichnung. Ein Klick genügt.",
      },
      {
        title: "Navigationshistorie",
        description:
          "Spring von Plan zu Plan und jederzeit zurück zum Ausgangspunkt — so einfach wie im Browser.",
      },
      {
        title: "Zentrale Projektablage",
        description:
          "Alle Pläne eines Projekts an einem Ort, für das ganze Team zugänglich und immer aktuell.",
      },
      {
        title: "Zeichnungsgruppen & Archiv",
        description:
          "Ordne Pläne in Gruppen und archiviere abgeschlossene Projekte, ohne etwas zu verlieren.",
      },
    ],
    steps: [
      {
        title: "Projekt anlegen & Pläne hochladen",
        description:
          "Leg ein Projekt an und lade Grundrisse, Schnitte und Details als PDF hoch.",
      },
      {
        title: "Zeichnungen verknüpfen",
        description:
          "Setze Marker von der Übersicht auf die Detailpläne — klickbar für alle.",
      },
      {
        title: "Büro navigiert gemeinsam",
        description:
          "Lade dein Team ein; alle arbeiten auf demselben, aktuellen Planstand.",
      },
    ],
    faq: [
      {
        question: "Welche Dateiformate unterstützt Link2plan?",
        answer:
          "Technische Pläne als PDF. Die Anzeige läuft komplett im Browser, ohne zusätzliche Software.",
      },
      {
        question: "Können mehrere Büromitarbeiter gleichzeitig zugreifen?",
        answer:
          "Ja. Lade dein Team in ein Projekt ein — alle sehen denselben, aktuellen Planstand.",
      },
      {
        question: "Sind die Daten DSGVO-konform gespeichert?",
        answer:
          "Ja. Alle Daten liegen auf Servern in der EU und werden DSGVO-konform verarbeitet.",
      },
    ],
    ctaTitle: "Hol dir die Übersicht über deine Baupläne",
    ctaSubtitle: "Kostenlos starten — im Browser, ohne Installation.",
  },
  {
    slug: "bauleitung-baustelle",
    shortLabel: "Bauleitung & Baustelle",
    metaTitle: "Pläne auf der Baustelle: mobil abrufen & navigieren | Link2plan",
    metaDescription:
      "Aktuelle Baupläne auf der Baustelle am Smartphone oder Tablet abrufen, per Marker navigieren und offline lesen. Immer der richtige Planstand, ohne Papierstapel.",
    eyebrow: "Für Bauleitung & Baustelle",
    h1: "Immer der richtige Plan — direkt auf der Baustelle",
    heroSubtitle:
      "Papierpläne sind schwer, schnell veraltet und unhandlich. Mit Link2plan hast du alle Pläne am Handy oder Tablet dabei, navigierst per Marker und liest sie auch offline.",
    problemTitle: "Kennst du das?",
    problems: [
      {
        title: "Veraltete Papierpläne",
        description:
          "Auf der Baustelle liegt oft nicht die aktuelle Revision — Fehler und Rückfragen sind vorprogrammiert.",
      },
      {
        title: "Kein Netz, kein Plan",
        description:
          "Funklöcher auf der Baustelle machen reine Cloud-Ordner unbrauchbar.",
      },
      {
        title: "Umständliches Blättern",
        description:
          "Zwischen Plänen zu wechseln bedeutet: einen großen Papierstapel durchsuchen.",
      },
    ],
    solutionTitle: "So löst Link2plan das",
    solutions: [
      {
        title: "Alle Pläne in der Hosentasche",
        description:
          "Ruf jeden Plan am Smartphone oder Tablet ab — als App (PWA) auf dem Startbildschirm installierbar.",
      },
      {
        title: "Offline lesen",
        description:
          "Einmal geöffnete Pläne stehen auch ohne Netz zur Verfügung.",
      },
      {
        title: "Per Marker navigieren",
        description:
          "Tippe auf einen Marker und der verknüpfte Plan öffnet sich — ganz ohne Blättern.",
      },
      {
        title: "Immer der aktuelle Stand",
        description:
          "Das Büro lädt neue Revisionen hoch, du hast sie sofort auf dem Gerät.",
      },
    ],
    steps: [
      {
        title: "Büro lädt die Pläne hoch",
        description:
          "Alle Projektpläne landen zentral in Link2plan — als PDF, versioniert.",
      },
      {
        title: "App auf dem Handy installieren",
        description:
          "Öffne Link2plan im Browser und füge es mit einem Tippen zum Startbildschirm hinzu.",
      },
      {
        title: "Auf der Baustelle navigieren",
        description:
          "Ruf den richtigen Plan ab, tippe dich per Marker durch — auch offline.",
      },
    ],
    faq: [
      {
        question: "Brauche ich eine App aus dem Store?",
        answer:
          "Nein. Link2plan läuft im Browser und lässt sich mit einem Tippen als App (PWA) auf dem Startbildschirm installieren.",
      },
      {
        question: "Funktioniert Link2plan offline?",
        answer:
          "Ja. Bereits geöffnete Pläne bleiben offline verfügbar — ideal bei schlechtem Empfang auf der Baustelle.",
      },
      {
        question: "Sehe ich immer die neueste Version?",
        answer:
          "Ja. Sobald das Büro eine neue Revision hochlädt, ist sie für dich abrufbar.",
      },
    ],
    ctaTitle: "Nimm deine Pläne mit auf die Baustelle",
    ctaSubtitle: "Kostenlos starten — im Browser, sofort einsatzbereit.",
  },
];

export function getUseCase(slug: string): UseCase | undefined {
  return useCases.find((u) => u.slug === slug);
}
