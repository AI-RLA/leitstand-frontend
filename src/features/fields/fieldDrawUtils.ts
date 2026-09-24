import type * as maplibregl from "maplibre-gl";
import type { MutableRefObject } from "react";

export type Stage = "drawing" | "naming";

export function updateSources(m: maplibregl.Map, v: [number, number][]): void {
  if (!m.getSource("draw-polygon")) return;
  const ring = v.length >= 3 ? [...v, v[0]] : [];
  (m.getSource("draw-polygon") as maplibregl.GeoJSONSource).setData({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: {},
  });
  (m.getSource("draw-line") as maplibregl.GeoJSONSource).setData({
    type: "Feature",
    geometry: { type: "LineString", coordinates: v },
    properties: {},
  });
  (m.getSource("draw-points") as maplibregl.GeoJSONSource).setData({
    type: "FeatureCollection",
    features: v.map((c, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: c },
      properties: { index: i },
    })),
  });
}

export function setupDrawInteraction(
  m: maplibregl.Map,
  vertsRef: MutableRefObject<[number, number][]>,
  stageRef: MutableRefObject<Stage>,
  setVerts: (v: [number, number][]) => void,
): void {
  let draggingIdx: number | null = null;
  let wasVertexMousedown = false;

  m.on("mouseenter", "draw-dots", () => {
    if (stageRef.current !== "drawing") return;
    m.getCanvas().style.cursor = "grab";
  });
  m.on("mouseleave", "draw-dots", () => {
    if (stageRef.current !== "drawing" || draggingIdx !== null) return;
    m.getCanvas().style.cursor = "crosshair";
  });
  m.on("mousedown", "draw-dots", (e) => {
    if (stageRef.current !== "drawing") return;
    e.preventDefault();
    wasVertexMousedown = true;
    const features = m.queryRenderedFeatures(e.point, {
      layers: ["draw-dots"],
    });
    if (!features.length) return;
    const idx = features[0].properties?.index as number | undefined;
    if (idx === undefined) return;
    draggingIdx = idx;
    m.getCanvas().style.cursor = "grabbing";
    const onMove = (ev: maplibregl.MapMouseEvent) => {
      if (draggingIdx === null) return;
      const next = [...vertsRef.current] as [number, number][];
      next[draggingIdx] = [ev.lngLat.lng, ev.lngLat.lat];
      setVerts(next);
      updateSources(m, next);
    };
    const onUp = () => {
      draggingIdx = null;
      wasVertexMousedown = false;
      m.getCanvas().style.cursor = "crosshair";
      m.off("mousemove", onMove);
    };
    m.on("mousemove", onMove);
    m.once("mouseup", onUp);
  });
  m.on("click", (e) => {
    if (stageRef.current !== "drawing") return;
    if (wasVertexMousedown) {
      wasVertexMousedown = false;
      return;
    }
    const next: [number, number][] = [
      ...vertsRef.current,
      [e.lngLat.lng, e.lngLat.lat],
    ];
    setVerts(next);
    updateSources(m, next);
  });
}

export const DRAW_SOURCES: Record<string, maplibregl.SourceSpecification> = {
  "draw-polygon": {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [] },
      properties: {},
    },
  },
  "draw-line": {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [] },
      properties: {},
    },
  },
  "draw-points": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
};

export const DRAW_LAYERS: maplibregl.LayerSpecification[] = [
  {
    id: "draw-fill",
    type: "fill",
    source: "draw-polygon",
    paint: { "fill-color": "#16A34A", "fill-opacity": 0.12 },
  },
  {
    id: "draw-outline",
    type: "line",
    source: "draw-polygon",
    paint: { "line-color": "#16A34A", "line-width": 2 },
  },
  {
    id: "draw-line",
    type: "line",
    source: "draw-line",
    paint: {
      "line-color": "#16A34A",
      "line-width": 2,
      "line-dasharray": [3, 2],
    },
  },
  {
    id: "draw-dots",
    type: "circle",
    source: "draw-points",
    paint: {
      "circle-radius": 5,
      "circle-color": "#fff",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#16A34A",
    },
  },
];
