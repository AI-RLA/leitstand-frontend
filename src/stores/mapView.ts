const KEY = "leitstand.mapView";
const BASEMAP_KEY = "leitstand.basemap";
const DEFAULT = { center: [8.020798, 52.286366] as [number, number], zoom: 17 };

function isMapView(
  v: unknown,
): v is { center: [number, number]; zoom: number } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.center) &&
    o.center.length === 2 &&
    o.center.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    typeof o.zoom === "number" &&
    Number.isFinite(o.zoom)
  );
}

export function loadMapView(): { center: [number, number]; zoom: number } {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isMapView(parsed)) return parsed;
    }
  } catch {
    // sessionStorage / localStorage may be unavailable (private browsing, quota)
  }
  return DEFAULT;
}

export function saveMapView(center: [number, number], zoom: number): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ center, zoom }));
  } catch {
    // sessionStorage / localStorage may be unavailable (private browsing, quota)
  }
}

export function loadBasemap(): "osm" | "dop" {
  try {
    const v = localStorage.getItem(BASEMAP_KEY);
    if (v === "osm" || v === "dop") return v;
  } catch {
    // sessionStorage / localStorage may be unavailable (private browsing, quota)
  }
  return "osm";
}

export function saveBasemap(basemap: "osm" | "dop"): void {
  try {
    localStorage.setItem(BASEMAP_KEY, basemap);
  } catch {
    // sessionStorage / localStorage may be unavailable (private browsing, quota)
  }
}
