// Shared WGS84 geodesy helpers. Single source of truth so the heading/marker
// projection and distance math don't drift between map components and adapters.

export const EARTH_RADIUS_M = 6371000;

/**
 * Destination point from (lat, lon) travelling `distanceM` metres along compass
 * `headingDeg` (degrees clockwise from true north). Returns [lon, lat] (GeoJSON
 * order). Standard forward great-circle (spherical) formula.
 */
export function headingEndpoint(
  lat: number,
  lon: number,
  headingDeg: number,
  distanceM: number,
): [number, number] {
  const bearing = (headingDeg * Math.PI) / 180;
  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lon * Math.PI) / 180;
  const d = distanceM / EARTH_RADIUS_M;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d) +
      Math.cos(phi1) * Math.sin(d) * Math.cos(bearing),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2),
    );
  return [(lambda2 * 180) / Math.PI, (phi2 * 180) / Math.PI];
}

/** Great-circle (haversine) distance in metres between two WGS84 points. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
