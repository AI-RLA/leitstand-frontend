import type { MapView } from "@/config/mapConfig";
const KEY = "leitstand.mapView";

function isMapView(v: unknown): v is MapView {
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

export function loadMapView(): MapView | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isMapView(parsed)) return parsed;
    }
  } catch {
    // sessionStorage / localStorage may be unavailable (private browsing, quota)
  }
  return null;
}

export function saveMapView(center: [number, number], zoom: number): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ center, zoom }));
  } catch {
    // sessionStorage / localStorage may be unavailable (private browsing, quota)
  }
}
