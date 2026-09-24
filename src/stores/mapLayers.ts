import { create } from "zustand";
import type { BasemapEntry } from "@/config/mapConfig";

const KEY = "leitstand.mapLayers";
const LEGACY_KEY = "leitstand.basemap";
const LEGACY_ROLE: Record<string, string> = { osm: "streets", dop: "aerial" };

type SavedBasemap = { id: string; role: string } | null;

function isSaved(v: unknown): v is { v: 2; basemap: SavedBasemap } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.v !== 2) return false;
  if (o.basemap === null) return true;
  const b = o.basemap as Record<string, unknown> | undefined;
  return typeof b?.id === "string" && typeof b.role === "string";
}

function save(basemap: SavedBasemap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 2, basemap }));
  } catch {
    // localStorage may be unavailable (private browsing, quota)
  }
}

function load(): SavedBasemap {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      localStorage.removeItem(LEGACY_KEY);
      const role = LEGACY_ROLE[legacy];
      if (role && localStorage.getItem(KEY) === null) {
        const migrated = { id: legacy, role };
        save(migrated);
        return migrated;
      }
    }
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isSaved(parsed)) return parsed.basemap;
    }
  } catch {
    // localStorage may be unavailable (private browsing, quota)
  }
  return null;
}

interface MapLayersState {
  basemap: SavedBasemap;
  selectBasemap: (entry: BasemapEntry) => void;
}

export const useMapLayers = create<MapLayersState>((set) => ({
  basemap: load(),
  selectBasemap: (entry) => {
    const basemap = { id: entry.id, role: entry.role };
    save(basemap);
    set({ basemap });
  },
}));

export function resolveBasemap(
  saved: SavedBasemap,
  entries: BasemapEntry[],
): BasemapEntry | null {
  if (saved) {
    const byId = entries.find((e) => e.id === saved.id);
    if (byId) return byId;
    const byRole = entries.find((e) => e.role === saved.role);
    if (byRole) return byRole;
  }
  return entries[0] ?? null;
}
