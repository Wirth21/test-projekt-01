#!/usr/bin/env node
/**
 * One-off backfill: generate server-side JPEG thumbnails for every
 * drawing_versions row where thumbnail_path IS NULL.
 *
 * Runs sequentially (one PDF at a time) to keep memory / connection
 * usage sane. Safe to re-run — only touches rows that still need it.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createClient } from "@supabase/supabase-js";

// pdfjs-dist legacy Node build — reachable via react-pdf's dependency.
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

// Load .env.local by hand (no dotenv dependency needed for a one-off script).
function loadEnv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch {
    // file missing is fine — env vars may come from the shell
  }
}
loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const THUMB_WIDTH = 600;
const THUMB_QUALITY = 0.75;

function thumbnailPathFor(pdfPath) {
  return pdfPath.replace(/\.pdf$/i, ".thumb.jpg");
}

async function renderThumbnail(pdfBytes) {
  const loadingTask = getDocument({
    data: pdfBytes,
    // Disable the worker in Node — we just run on the main thread.
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = THUMB_WIDTH / unscaled.width;
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    return canvas.toBuffer("image/jpeg", THUMB_QUALITY);
  } finally {
    await pdf.destroy();
  }
}

async function backfillOne(version) {
  const { id, storage_path, drawing_id } = version;
  process.stdout.write(`  [${id.slice(0, 8)}] ${storage_path} ... `);

  // 1. Download PDF
  const { data: pdfBlob, error: dlError } = await sb.storage
    .from("drawings")
    .download(storage_path);
  if (dlError || !pdfBlob) {
    console.log(`SKIP (download failed: ${dlError?.message ?? "no data"})`);
    return { ok: false, reason: "download" };
  }
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

  // 2. Render page 1 → JPEG buffer
  let jpegBuffer;
  try {
    jpegBuffer = await renderThumbnail(pdfBytes);
  } catch (err) {
    console.log(`SKIP (render failed: ${err?.message ?? err})`);
    return { ok: false, reason: "render" };
  }

  // 3. Upload JPEG
  const thumbPath = thumbnailPathFor(storage_path);
  const { error: upError } = await sb.storage
    .from("drawings")
    .upload(thumbPath, jpegBuffer, { contentType: "image/jpeg", upsert: true });
  if (upError) {
    console.log(`FAIL (upload: ${upError.message})`);
    return { ok: false, reason: "upload" };
  }

  // 4. Link in DB
  const { error: updError } = await sb
    .from("drawing_versions")
    .update({ thumbnail_path: thumbPath })
    .eq("id", id);
  if (updError) {
    console.log(`FAIL (db update: ${updError.message})`);
    return { ok: false, reason: "db" };
  }

  console.log(`OK (${jpegBuffer.length.toString().padStart(6)} B)`);
  return { ok: true, drawing_id };
}

async function main() {
  console.log("Backfilling server-side PDF thumbnails...");

  const { data: versions, error } = await sb
    .from("drawing_versions")
    .select("id, drawing_id, storage_path, is_archived")
    .is("thumbnail_path", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  if (!versions || versions.length === 0) {
    console.log("Nothing to do — every version already has a thumbnail.");
    return;
  }

  console.log(`Found ${versions.length} versions without thumbnails.\n`);

  let ok = 0;
  let fail = 0;
  const reasons = {};
  for (let i = 0; i < versions.length; i++) {
    process.stdout.write(`[${String(i + 1).padStart(3)}/${versions.length}] `);
    const result = await backfillOne(versions[i]);
    if (result.ok) ok++;
    else {
      fail++;
      reasons[result.reason] = (reasons[result.reason] ?? 0) + 1;
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${fail} failed.`);
  if (fail > 0) console.log("Failures by reason:", reasons);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
