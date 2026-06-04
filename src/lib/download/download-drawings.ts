import { downloadZip } from "client-zip";

/**
 * PROJ-29 — Client-side download of drawing PDFs.
 *
 * The server (`POST /api/projects/[id]/downloads/sign`) resolves a scope to a
 * set of signed URLs + ZIP entry names. Here we either trigger a direct
 * single-file download or stream every file into a ZIP with `client-zip`
 * (constant-ish memory, no server compute). A single failing file (expired /
 * 404) is skipped so it can't abort the whole archive.
 */

export type DownloadScope =
  | "current"
  | "current-versions"
  | "all-current"
  | "all-versions";

interface SignFile {
  signedUrl: string;
  zipEntryName: string;
}

interface SignResponse {
  single: boolean;
  zipName?: string;
  fileName?: string;
  files: SignFile[];
  count: number;
  totalBytes: number;
}

export interface DownloadResult {
  count: number;
  totalBytes: number;
}

async function requestSign(
  projectId: string,
  scope: DownloadScope,
  drawingId?: string
): Promise<SignResponse> {
  const res = await fetch(`/api/projects/${projectId}/downloads/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, drawingId }),
  });
  if (!res.ok) {
    let msg = "Download fehlgeschlagen";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error as string;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  return (await res.json()) as SignResponse;
}

function triggerBrowserDownload(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Stream each signed file into the ZIP, skipping any that fail so one bad
// (expired/404) entry can't abort the archive.
async function* zipEntries(
  files: SignFile[],
  onProgress?: (done: number, total: number) => void
): AsyncGenerator<{ name: string; input: Response }> {
  let done = 0;
  for (const f of files) {
    try {
      const res = await fetch(f.signedUrl);
      if (res.ok && res.body) {
        yield { name: f.zipEntryName, input: res };
      }
    } catch {
      /* skip failed file */
    } finally {
      done++;
      onProgress?.(done, files.length);
    }
  }
}

export async function downloadDrawings(opts: {
  projectId: string;
  scope: DownloadScope;
  drawingId?: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<DownloadResult> {
  const { projectId, scope, drawingId, onProgress } = opts;
  const data = await requestSign(projectId, scope, drawingId);

  // Single file: the signed URL already carries Content-Disposition: attachment.
  if (data.single) {
    triggerBrowserDownload(data.files[0].signedUrl, data.fileName);
    return { count: data.count, totalBytes: data.totalBytes };
  }

  const blob = await downloadZip(zipEntries(data.files, onProgress)).blob();
  const url = URL.createObjectURL(blob);
  try {
    triggerBrowserDownload(url, data.zipName ?? "download.zip");
  } finally {
    // Give the browser time to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return { count: data.count, totalBytes: data.totalBytes };
}
