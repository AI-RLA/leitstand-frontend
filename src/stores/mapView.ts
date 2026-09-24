const KEY = "leitstand.mapView";
export interface SavedMapView {
  center: [number, number];
  zoom: number;
}

const DEFAULT: SavedMapView = { center: [8.020798, 52.286366], zoom: 17 };

function isMapView(v: unknown): v is SavedMapView {
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

export function loadMapView(): SavedMapView {
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
