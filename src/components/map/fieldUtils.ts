import type { Field } from "@/api/client";

export function fieldBbox(geometry: {
  coordinates: number[][][];
}): [[number, number], [number, number]] {
  const ring = geometry.coordinates[0];
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
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
