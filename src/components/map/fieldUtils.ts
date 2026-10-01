import type { Field } from "@/api/client";
import type * as GeoJSON from "geojson";

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

/** The box around a polygon's outer ring, or null for a ring without points. */
export function fieldBbox(geometry: {
  coordinates: number[][][];
}): LngLatBox | null {
  return bboxOfPoints(geometry.coordinates[0] ?? []);
}

export const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** A GeoJSON polygon feature, rebuilt because the generated API type allows a null bbox. */
export function polygonFeature(
  coordinates: number[][][],
): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates },
    properties: {},
  };
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
