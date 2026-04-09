import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/** Metadata fields added to every cached record */
export interface CacheMeta {
  _syncedAt: number; // timestamp ms
  _tenantId: string;
}

/** Sync metadata stored per cache key */
export interface SyncMetaEntry {
  key: string;
  lastSynced: number;
  tenantId: string;
}

interface Link2PlanDB extends DBSchema {
  projects: {
    key: string;
    value: Record<string, unknown> & CacheMeta;
    indexes: { "by-tenant": string };
  };
  drawings: {
    key: string;
    value: Record<string, unknown> & CacheMeta;
    indexes: { "by-project": string; "by-tenant": string };
  };
  versions: {
    key: string;
    value: Record<string, unknown> & CacheMeta & { _pdfCached?: boolean };
    indexes: { "by-drawing": string; "by-tenant": string };
  };
  markers: {
    key: string;
    value: Record<string, unknown> & CacheMeta;
    indexes: { "by-drawing-version": string; "by-tenant": string };
  };
  drawing_groups: {
    key: string;
    value: Record<string, unknown> & CacheMeta;
    indexes: { "by-project": string; "by-tenant": string };
  };
  sync_meta: {
    key: string;
    value: SyncMetaEntry;
  };
}

const DB_NAME = "link2plan-cache";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<Link2PlanDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<Link2PlanDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available on the server"));
  }

  if (!dbPromise) {
    dbPromise = openDB<Link2PlanDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Projects store
        const projectStore = db.createObjectStore("projects", { keyPath: "id" });
        projectStore.createIndex("by-tenant", "_tenantId");

        // Drawings store
        const drawingStore = db.createObjectStore("drawings", { keyPath: "id" });
        drawingStore.createIndex("by-project", "project_id");
        drawingStore.createIndex("by-tenant", "_tenantId");

        // Versions store
        const versionStore = db.createObjectStore("versions", { keyPath: "id" });
        versionStore.createIndex("by-drawing", "drawing_id");
        versionStore.createIndex("by-tenant", "_tenantId");

        // Markers store
        const markerStore = db.createObjectStore("markers", { keyPath: "id" });
        markerStore.createIndex("by-drawing-version", "drawing_version_id");
        markerStore.createIndex("by-tenant", "_tenantId");

        // Drawing groups store
        const groupStore = db.createObjectStore("drawing_groups", { keyPath: "id" });
        groupStore.createIndex("by-project", "project_id");
        groupStore.createIndex("by-tenant", "_tenantId");

        // Sync metadata store
        db.createObjectStore("sync_meta", { keyPath: "key" });
      },
    });
  }

  return dbPromise;
}

export type StoreName = "projects" | "drawings" | "versions" | "markers" | "drawing_groups";

/** Write an array of records to a store, adding cache metadata */
export async function cacheRecords(
  storeName: StoreName,
  records: Record<string, unknown>[],
  tenantId: string
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  const now = Date.now();

  for (const record of records) {
    await tx.store.put({
      ...record,
      _syncedAt: now,
      _tenantId: tenantId,
    } as Link2PlanDB[typeof storeName]["value"]);
  }

  await tx.done;
}

/** Read all records from a store filtered by an index */
export async function getCachedByIndex<T = Record<string, unknown>>(
  storeName: StoreName,
  indexName: string,
  value: string
): Promise<T[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex(
    storeName,
    indexName as never,
    IDBKeyRange.only(value)
  );
  return records as T[];
}

/** Read all records from a store for a specific tenant */
export async function getCachedByTenant<T = Record<string, unknown>>(
  storeName: StoreName,
  tenantId: string
): Promise<T[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex(storeName, "by-tenant" as never, IDBKeyRange.only(tenantId));
  return records as T[];
}

/** Get or set sync metadata for a cache key */
export async function getSyncMeta(key: string): Promise<SyncMetaEntry | undefined> {
  const db = await getDB();
  return db.get("sync_meta", key);
}

export async function setSyncMeta(entry: SyncMetaEntry): Promise<void> {
  const db = await getDB();
  await db.put("sync_meta", entry);
}

/** Clear all cached data for a specific tenant */
export async function clearTenantCache(tenantId: string): Promise<void> {
  const db = await getDB();
  const storeNames: StoreName[] = ["projects", "drawings", "versions", "markers", "drawing_groups"];

  for (const storeName of storeNames) {
    const tx = db.transaction(storeName, "readwrite");
    const index = tx.store.index("by-tenant" as never);
    let cursor = await index.openCursor(IDBKeyRange.only(tenantId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  // Also clear sync_meta for this tenant
  const metaTx = db.transaction("sync_meta", "readwrite");
  let metaCursor = await metaTx.store.openCursor();
  while (metaCursor) {
    if (metaCursor.value.tenantId === tenantId) {
      await metaCursor.delete();
    }
    metaCursor = await metaCursor.continue();
  }
  await metaTx.done;
}

/** Clear all cached data for a specific project */
export async function clearProjectCache(projectId: string): Promise<void> {
  const db = await getDB();

  // Clear drawings for this project
  const drawings = await db.getAllFromIndex("drawings", "by-project", projectId);
  const drawingIds = drawings.map((d) => d.id as string);

  const drawingTx = db.transaction("drawings", "readwrite");
  for (const d of drawings) {
    await drawingTx.store.delete(d.id as string);
  }
  await drawingTx.done;

  // Clear versions for these drawings
  for (const drawingId of drawingIds) {
    const versions = await db.getAllFromIndex("versions", "by-drawing", drawingId);
    const vTx = db.transaction("versions", "readwrite");
    for (const v of versions) {
      await vTx.store.delete(v.id as string);
    }
    await vTx.done;

    // Clear markers for these drawings
    // Markers are indexed by drawing_version_id, but we need to clear all markers for a drawing
    // We'll iterate all markers and filter by drawing_id
  }

  // Clear markers — iterate and filter by drawing_id
  const markerTx = db.transaction("markers", "readwrite");
  let markerCursor = await markerTx.store.openCursor();
  while (markerCursor) {
    if (markerCursor.value.drawing_id && drawingIds.includes(markerCursor.value.drawing_id as string)) {
      await markerCursor.delete();
    }
    markerCursor = await markerCursor.continue();
  }
  await markerTx.done;

  // Clear drawing groups for this project
  const groups = await db.getAllFromIndex("drawing_groups", "by-project", projectId);
  const groupTx = db.transaction("drawing_groups", "readwrite");
  for (const g of groups) {
    await groupTx.store.delete(g.id as string);
  }
  await groupTx.done;

  // Clear project itself
  await db.delete("projects", projectId);
}

/** Estimate cache size for a tenant (approximate, in bytes) */
export async function estimateCacheSize(): Promise<{
  indexedDB: number;
  cacheAPI: number;
  total: number;
}> {
  let cacheAPISize = 0;

  // Estimate Cache API size (PDFs)
  try {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      // This gives total usage, not just our cache, but it's the best we can do
      cacheAPISize = estimate.usage ?? 0;
    }
  } catch {
    // Ignore errors
  }

  // For a more accurate per-cache estimate, count PDF cache entries
  let pdfCacheSize = 0;
  try {
    const cache = await caches.open("link2plan-pdfs");
    const keys = await cache.keys();
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        pdfCacheSize += blob.size;
      }
    }
  } catch {
    // Cache API not available
  }

  return {
    indexedDB: 0, // Hard to measure precisely, but small compared to PDFs
    cacheAPI: pdfCacheSize,
    total: pdfCacheSize,
  };
}
