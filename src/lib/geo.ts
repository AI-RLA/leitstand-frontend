// Shared WGS84 geodesy helpers. Single source of truth so the heading/marker
// projection and distance math don't drift between map components and adapters.
import { degreesToRadians, radiansToDegrees } from "./units";

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
  const bearing = degreesToRadians(headingDeg);
  const phi1 = degreesToRadians(lat);
  const lambda1 = degreesToRadians(lon);
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
  return [radiansToDegrees(lambda2), radiansToDegrees(phi2)];
}

/** Great-circle (haversine) distance in metres between two WGS84 points. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const dPhi = degreesToRadians(lat2 - lat1);
  const dLambda = degreesToRadians(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
