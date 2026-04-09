/** Format a timestamp as relative time string */
export function formatLastSynced(timestamp: number | null, locale: string = "de"): string {
  if (!timestamp) return locale === "de" ? "Nie synchronisiert" : "Never synced";

  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return locale === "de" ? "Gerade eben" : "Just now";
  }
  if (minutes < 60) {
    return locale === "de"
      ? `Vor ${minutes} Min.`
      : `${minutes} min ago`;
  }
  if (hours < 24) {
    return locale === "de"
      ? `Vor ${hours} Std.`
      : `${hours}h ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
