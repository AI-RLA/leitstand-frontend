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

export function toFieldGeoJSON(fields: Field[]) {
  return {
    type: "FeatureCollection" as const,
    features: fields.map((f) => ({
      type: "Feature" as const,
      id: f.id,
      properties: {
        id: f.id,
        name: f.name,
        area_ha: f.area_ha,
        notes: f.notes,
      },
      geometry: f.geometry,
    })),
  };
}
