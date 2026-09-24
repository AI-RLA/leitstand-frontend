import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
} from "@vis.gl/react-maplibre";
import type { LineLayerSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { headingEndpoint } from "@/lib/geo";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { FitBounds } from "@/components/map/FitBounds";
import { DrawLayer, type Vertex } from "@/components/map/draw/DrawLayer";

export type SiteCreateStep =
  | "place-anchor"
  | "set-heading"
  | "trace-outline"
  | "done";

export type Anchor = { lat: number; lon: number };

interface SiteCreateMapProps {
  step: SiteCreateStep;
  anchor: Anchor | null;
  heading: number;
  outline: Vertex[];
  onAnchorChange: (anchor: Anchor) => void;
  onOutlineChange: Dispatch<SetStateAction<Vertex[]>>;
}

const HEADING_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#16A34A",
  "line-width": 3,
};

const NO_HEADING: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function SiteCreateMap({
  step,
  anchor,
  heading,
  outline,
  onAnchorChange,
  onOutlineChange,
}: SiteCreateMapProps) {
  const [drawCursor, setDrawCursor] = useState("crosshair");

  const headingLine = useMemo<Feature<LineString> | FeatureCollection>(() => {
    if (!anchor) return NO_HEADING;
    const endpoint = headingEndpoint(anchor.lat, anchor.lon, heading, 14);
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [[anchor.lon, anchor.lat], endpoint],
      },
    };
  }, [anchor, heading]);

  // A zero-size box fits at maxZoom, so the first anchor brings the map to it at zoom 18.
  const anchorBounds = useMemo<[Vertex, Vertex] | null>(
    () =>
      anchor
        ? [
            [anchor.lon, anchor.lat],
            [anchor.lon, anchor.lat],
          ]
        : null,
    [anchor],
  );

  const cursor =
    step === "trace-outline"
      ? drawCursor
      : step === "place-anchor"
        ? "crosshair"
        : "";

  return (
    <LeitstandMap
      view={{ center: [8.020798, 52.286366], zoom: 17 }}
      cursor={cursor}
      onClick={
        step === "place-anchor"
          ? (e: MapLayerMouseEvent) =>
              onAnchorChange({ lat: e.lngLat.lat, lon: e.lngLat.lng })
          : undefined
      }
    >
      <DrawLayer
        vertices={outline}
        onChange={onOutlineChange}
        enabled={step === "trace-outline"}
        onCursor={setDrawCursor}
      />
      <Source id="sn-heading" type="geojson" data={headingLine}>
        <Layer id="sn-heading-line" type="line" paint={HEADING_PAINT} />
      </Source>
      {anchor && (
        <Marker
          longitude={anchor.lon}
          latitude={anchor.lat}
          anchor="center"
          draggable
          onDrag={(e) =>
            onAnchorChange({ lat: e.lngLat.lat, lon: e.lngLat.lng })
          }
        >
          <div className="h-[18px] w-[18px] cursor-grab rounded-full border-[3px] border-white bg-[#16A34A] shadow-[0_1px_3px_rgba(0,0,0,0.3)]" />
        </Marker>
      )}
      <FitBounds
        bounds={anchorBounds}
        fitKey={anchor ? "anchor" : null}
        padding={0}
        maxZoom={18}
      />
    </LeitstandMap>
  );
}
