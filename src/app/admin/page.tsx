import { redirect } from "next/navigation";

// /admin landet jetzt direkt auf /admin/users — Freigaben sind unter
// /admin/pending erreichbar.
export default function AdminIndex() {
  redirect("/admin/users");
}
