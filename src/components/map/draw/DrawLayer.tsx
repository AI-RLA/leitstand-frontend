import {
  useEffect,
  useEffectEvent,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Layer, Source, useMap } from "@vis.gl/react-maplibre";
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
} from "geojson";
import {
  DOTS_LAYER,
  setupDrawInteraction,
  type DrawCursor,
  type Vertex,
} from "./drawInteraction";

const GREEN = "#16A34A";
const FILL_PAINT: FillLayerSpecification["paint"] = {
  "fill-color": GREEN,
  "fill-opacity": 0.12,
};
const OUTLINE_PAINT: LineLayerSpecification["paint"] = {
  "line-color": GREEN,
  "line-width": 2,
};
const OPEN_PATH_PAINT: LineLayerSpecification["paint"] = {
  "line-color": GREEN,
  "line-width": 2,
  "line-dasharray": [3, 2],
};
const DOTS_PAINT: CircleLayerSpecification["paint"] = {
  "circle-radius": 5,
  "circle-color": "#fff",
  "circle-stroke-width": 2,
  "circle-stroke-color": GREEN,
};

export type { Vertex } from "./drawInteraction";

interface Props {
  vertices: Vertex[];
  onChange: Dispatch<SetStateAction<Vertex[]>>;
  enabled: boolean;
  // The whole map cursor while drawing: crosshair, grab over a vertex, grabbing while dragging, default when off.
  onCursor: (cursor: string) => void;
}

export function DrawLayer({ vertices, onChange, enabled, onCursor }: Props) {
  const map = useMap().current?.getMap();
  const add = useEffectEvent((v: Vertex) => onChange((prev) => [...prev, v]));
  const move = useEffectEvent((i: number, v: Vertex) =>
    onChange((prev) => prev.with(i, v)),
  );
  const cursor = useEffectEvent((c: DrawCursor | "default") =>
    onCursor(c ?? "crosshair"),
  );

  useEffect(() => {
    if (!map || !enabled) return;
    cursor(null);
    const dispose = setupDrawInteraction(map, {
      add: (v) => add(v),
      move: (i, v) => move(i, v),
      cursor: (c) => cursor(c),
    });
    return () => {
      dispose();
      cursor("default");
    };
  }, [map, enabled]);

  const { polygon, line, points } = useMemo(() => {
    const polygon: Feature<Polygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: vertices.length >= 3 ? [[...vertices, vertices[0]]] : [],
      },
    };
    const line: Feature<LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: vertices },
    };
    const points: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: vertices.map((c, index) => ({
        type: "Feature",
        properties: { index },
        geometry: { type: "Point", coordinates: c },
      })),
    };
    return { polygon, line, points };
  }, [vertices]);

  return (
    <>
      <Source id="draw-polygon" type="geojson" data={polygon}>
        <Layer id="draw-fill" type="fill" paint={FILL_PAINT} />
        <Layer id="draw-outline" type="line" paint={OUTLINE_PAINT} />
      </Source>
      <Source id="draw-line" type="geojson" data={line}>
        <Layer id="draw-line" type="line" paint={OPEN_PATH_PAINT} />
      </Source>
      <Source id="draw-points" type="geojson" data={points}>
        <Layer id={DOTS_LAYER} type="circle" paint={DOTS_PAINT} />
      </Source>
    </>
  );
}
