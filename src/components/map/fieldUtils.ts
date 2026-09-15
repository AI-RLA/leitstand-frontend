import type { Field } from "@/api/client";

export type LngLatBox = [[number, number], [number, number]];

/** The box around [lon, lat] points, or null for none. */
export function bboxOfPoints(points: Iterable<number[]>): LngLatBox | null {
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (!Number.isFinite(minLon)) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

export function fieldBbox(geometry: { coordinates: number[][][] }): LngLatBox {
  // A polygon has at least one ring with points, so the box is never null.
  return bboxOfPoints(geometry.coordinates[0])!;
}

export function toFieldGeoJSON(fields: Field[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fields.map((f) => ({
      type: "Feature",
      id: f.id,
      properties: {
        id: f.id,
        name: f.name,
        area_ha: f.area_ha,
        notes: f.notes,
      },
      // Field.geometry is the wire (openapi) polygon shape; assert once here so
      // callers get a properly-typed FeatureCollection without per-call casts.
      geometry: f.geometry as GeoJSON.Geometry,
    })),
  };
}
