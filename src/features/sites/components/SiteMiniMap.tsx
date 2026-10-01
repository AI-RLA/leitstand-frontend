import { useMemo } from "react";
import { Layer, Source } from "@vis.gl/react-maplibre";
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { Feature, LineString, Point } from "geojson";
import { headingEndpoint } from "@/lib/geo";
import { EMPTY_FC, polygonFeature } from "@/components/map/fieldUtils";
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
const ANCHOR_ZOOM = 17;
const ANCHOR_PAINT: CircleLayerSpecification["paint"] = {
  "circle-radius": 7,
  "circle-color": "#16A34A",
  "circle-stroke-color": "#fff",
  "circle-stroke-width": 2,
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
    () => (outline ? polygonFeature(outline.coordinates) : EMPTY_FC),
    [outline],
  );

  return (
    <div className="relative h-[320px] rounded-lg overflow-hidden border border-border mb-3">
      <LeitstandMap
        view={{ center: [anchorLon, anchorLat], zoom: ANCHOR_ZOOM }}
        viewKey={`${vm.id}:${anchorLon},${anchorLat}`}
        viewDuration={0}
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
      </LeitstandMap>
    </div>
  );
}
