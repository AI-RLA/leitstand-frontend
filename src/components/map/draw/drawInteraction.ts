import type * as maplibregl from "maplibre-gl";

export type Vertex = [number, number];
export type DrawCursor = "grab" | "grabbing" | null;

export const DOTS_LAYER = "draw-dots";

export interface DrawCallbacks {
  add: (v: Vertex) => void;
  move: (index: number, v: Vertex) => void;
  cursor: (c: DrawCursor) => void;
}

// Follows MapLibre's "Create a draggable point" example and returns the cleanup an effect needs.
export function setupDrawInteraction(
  m: maplibregl.Map,
  cb: DrawCallbacks,
): () => void {
  let dragging: number | null = null;

  const overDot = (e: maplibregl.MapMouseEvent) =>
    m.queryRenderedFeatures(e.point, { layers: [DOTS_LAYER] }).length > 0;

  const onEnter = () => {
    if (dragging === null) cb.cursor("grab");
  };
  const onLeave = () => {
    if (dragging === null) cb.cursor(null);
  };
  const onMove = (e: maplibregl.MapMouseEvent) => {
    if (dragging !== null) cb.move(dragging, [e.lngLat.lng, e.lngLat.lat]);
  };
  const onUp = (e: maplibregl.MapMouseEvent) => {
    dragging = null;
    m.off("mousemove", onMove);
    cb.cursor(overDot(e) ? "grab" : null);
  };
  const onDown = (e: maplibregl.MapLayerMouseEvent) => {
    const index = e.features?.[0]?.properties?.index;
    if (typeof index !== "number") return;
    e.preventDefault();
    dragging = index;
    cb.cursor("grabbing");
    m.on("mousemove", onMove);
    m.once("mouseup", onUp);
  };
  const onClick = (e: maplibregl.MapMouseEvent) => {
    // A press on a vertex that is released without moving still fires a map click.
    if (overDot(e)) return;
    cb.add([e.lngLat.lng, e.lngLat.lat]);
  };

  m.on("mouseenter", DOTS_LAYER, onEnter);
  m.on("mouseleave", DOTS_LAYER, onLeave);
  m.on("mousedown", DOTS_LAYER, onDown);
  m.on("click", onClick);
  return () => {
    m.off("mouseenter", DOTS_LAYER, onEnter);
    m.off("mouseleave", DOTS_LAYER, onLeave);
    m.off("mousedown", DOTS_LAYER, onDown);
    m.off("click", onClick);
    m.off("mousemove", onMove);
    m.off("mouseup", onUp);
  };
}
