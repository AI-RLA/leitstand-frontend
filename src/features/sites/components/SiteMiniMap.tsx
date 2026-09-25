import { useMemo } from "react";
import { Layer, Source } from "@vis.gl/react-maplibre";
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { headingEndpoint } from "@/lib/geo";
import { FitBounds } from "@/components/map/FitBounds";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import type { SiteViewModel } from "../adapters";

interface SiteMiniMapProps {
  vm: SiteViewModel;
}

const OUTLINE_FILL_PAINT: FillLayerSpecification["paint"] = {
  "fill-color": "#16A34A",
  "fill-opacity": 0.15,
};
const OUTLINE_LINE_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#16A34A",
  "line-width": 2,
};
const HEADING_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#16A34A",
  "line-width": 3,
};
const ANCHOR_PAINT: CircleLayerSpecification["paint"] = {
  "circle-radius": 7,
  "circle-color": "#16A34A",
  "circle-stroke-color": "#fff",
  "circle-stroke-width": 2,
};

const NO_OUTLINE: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function SiteMiniMap({ vm }: SiteMiniMapProps) {
  const { anchorLat, anchorLon, anchorHeadingDeg, outline } = vm;

  const anchor = useMemo<Feature<Point>>(
    () => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [anchorLon, anchorLat] },
      properties: {},
    }),
    [anchorLat, anchorLon],
  );

  const heading = useMemo<Feature<LineString>>(
    () => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [anchorLon, anchorLat],
          headingEndpoint(anchorLat, anchorLon, anchorHeadingDeg, 12),
        ],
      },
      properties: {},
    }),
    [anchorLat, anchorLon, anchorHeadingDeg],
  );

  const outlineData = useMemo(
    () =>
      outline
        ? {
            type: "Feature" as const,
            // Rebuilt rather than passed through, because the generated type allows a null bbox.
            geometry: {
              type: "Polygon" as const,
              coordinates: outline.coordinates,
            },
            properties: {},
          }
        : NO_OUTLINE,
    [outline],
  );

  // A zero-size box fits at maxZoom, so a saved anchor or another site brings the map to it.
  const anchorBounds = useMemo<[[number, number], [number, number]]>(
    () => [
      [anchorLon, anchorLat],
      [anchorLon, anchorLat],
    ],
    [anchorLat, anchorLon],
  );

  return (
    <div className="relative h-[320px] rounded-lg overflow-hidden border border-border mb-3">
      <LeitstandMap
        view={{ center: [anchorLon, anchorLat], zoom: 17 }}
        navigation={false}
      >
        <Source id="site-outline" type="geojson" data={outlineData}>
          <Layer
            id="site-outline-fill"
            type="fill"
            paint={OUTLINE_FILL_PAINT}
          />
          <Layer
            id="site-outline-line"
            type="line"
            paint={OUTLINE_LINE_PAINT}
          />
        </Source>
        <Source id="site-heading" type="geojson" data={heading}>
          <Layer id="site-heading-line" type="line" paint={HEADING_PAINT} />
        </Source>
        <Source id="site-anchor" type="geojson" data={anchor}>
          <Layer id="site-anchor-dot" type="circle" paint={ANCHOR_PAINT} />
        </Source>
        <FitBounds
          bounds={anchorBounds}
          fitKey={`${vm.id}:${anchorLon},${anchorLat}`}
          padding={0}
          maxZoom={17}
          duration={0}
        />
      </LeitstandMap>
    </div>
  );
}
