import type { Site } from "@/api/client";

export interface SiteAnchor {
  lat: number;
  lon: number;
  headingDeg: number;
}

export function anchorFromSite(site: Site): SiteAnchor {
  return {
    lat: site.anchor_lat,
    lon: site.anchor_lon,
    headingDeg: site.anchor_heading_deg,
  };
}

const EARTH_R = 6371000;
const M_PER_DEG = (Math.PI / 180) * EARTH_R;

// Tangent-plane projection between WGS84 and site-local frame.
// Local frame: x = forward (direction of anchor heading), y = right of x.
// Good for ~km-scale sites; not for region-scale.

export function latLonToLocal(
  anchor: SiteAnchor,
  lat: number,
  lon: number,
): { x: number; y: number } {
  const headingRad = (anchor.headingDeg * Math.PI) / 180;
  const dN = (lat - anchor.lat) * M_PER_DEG;
  const dE =
    (lon - anchor.lon) * M_PER_DEG * Math.cos((anchor.lat * Math.PI) / 180);
  const x = dN * Math.cos(headingRad) + dE * Math.sin(headingRad);
  const y = -dN * Math.sin(headingRad) + dE * Math.cos(headingRad);
  return { x, y };
}

export function localToLatLon(
  anchor: SiteAnchor,
  x: number,
  y: number,
): { lat: number; lon: number } {
  const headingRad = (anchor.headingDeg * Math.PI) / 180;
  const dN = x * Math.cos(headingRad) - y * Math.sin(headingRad);
  const dE = x * Math.sin(headingRad) + y * Math.cos(headingRad);
  const lat = anchor.lat + dN / M_PER_DEG;
  const lon =
    anchor.lon + dE / M_PER_DEG / Math.cos((anchor.lat * Math.PI) / 180);
  return { lat, lon };
}
