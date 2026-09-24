import type * as maplibregl from "maplibre-gl";
import type { CoverageStage } from "@/api/client";
import { bboxOfPoints } from "@/components/map/fieldUtils";
import { stageDrivenWaypoints } from "../stageWaypoints";
import type * as GeoJSON from "geojson";

/** The whole route of each planned stage, turns included, as [lng, lat] lines. */
export function coverageLines(stages: CoverageStage[]): [number, number][][] {
  return stages.map((stage) =>
    stageDrivenWaypoints(stage).flatMap((w) =>
      w.kind === "wgs84" ? [[w.lon, w.lat] as [number, number]] : [],
    ),
  );
}

/** One polygon per stage: the field less its headland, where the swaths had to stop. */
export function mainlandFeatures(
  stages: CoverageStage[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: stages.flatMap((stage) => {
      const mainland = stage.provenance.mainland_boundary;
      if (!mainland) return [];
      return [
        {
          type: "Feature" as const,
          // Rebuilt rather than passed through: the generated type allows a null bbox, which the
          // GeoJSON types this map is written against do not.
          geometry: {
            type: "Polygon" as const,
            coordinates: mainland.coordinates as GeoJSON.Position[][],
          },
          properties: {},
        },
      ];
    }),
  };
}

// Solid, uncased and in the field's own green, because the mainland is part of the field and a
// dashed, cased line is how these maps draw a driven path.
export function mainlandLayer(
  id: string,
  source: string,
): maplibregl.LayerSpecification {
  return {
    id,
    type: "line",
    source,
    paint: {
      "line-color": "#16A34A",
      "line-width": 1.25,
      "line-opacity": 0.55,
    },
  };
}

export function coverageBounds(
  lines: [number, number][][],
): maplibregl.LngLatBoundsLike | null {
  return bboxOfPoints(lines.flat());
}
