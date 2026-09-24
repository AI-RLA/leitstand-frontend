import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { headingEndpoint } from "@/lib/geo";
import {
  mapSources,
  baseLayers,
} from "@/components/map/BasemapControl.constants";
import { LayerControl } from "@/components/map/LayerControl";
import {
  type Stage,
  updateSources,
  setupDrawInteraction,
  DRAW_SOURCES,
  DRAW_LAYERS,
} from "@/features/fields/fieldDrawUtils";

export type SiteCreateStep =
  | "place-anchor"
  | "set-heading"
  | "trace-outline"
  | "done";

interface SiteCreateMapProps {
  step: SiteCreateStep;
  anchor: { lat: number; lon: number } | null;
  heading: number;
  outline: [number, number][];
  onAnchorChange: (anchor: { lat: number; lon: number }) => void;
  onOutlineChange: (verts: [number, number][]) => void;
}

const ANCHOR_SOURCES: Record<string, maplibregl.SourceSpecification> = {
  ...DRAW_SOURCES,
  "sn-heading": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
};

const ANCHOR_LAYERS: maplibregl.LayerSpecification[] = [
  ...DRAW_LAYERS,
  {
    id: "sn-heading-line",
    type: "line",
    source: "sn-heading",
    paint: { "line-color": "#16A34A", "line-width": 3 },
  },
];

export function SiteCreateMap({
  step,
  anchor,
  heading,
  outline,
  onAnchorChange,
  onOutlineChange,
}: SiteCreateMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loadedMap, setLoadedMap] = useState<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Latest props in refs so map event handlers (registered once) see fresh
  // values without re-binding.
  const stepRef = useRef(step);
  const anchorRef = useRef(anchor);
  const onAnchorRef = useRef(onAnchorChange);
  const onOutlineRef = useRef(onOutlineChange);
  const outlineRef = useRef(outline);
  // The draw interaction uses its own Stage type — "drawing" only when we're
  // actively tracing the polygon. Other steps map to "naming" (idle).
  const drawStageRef = useRef<Stage>("naming");

  useEffect(() => {
    stepRef.current = step;
    drawStageRef.current = step === "trace-outline" ? "drawing" : "naming";
  }, [step]);
  useEffect(() => {
    anchorRef.current = anchor;
  }, [anchor]);
  useEffect(() => {
    onAnchorRef.current = onAnchorChange;
  }, [onAnchorChange]);
  useEffect(() => {
    onOutlineRef.current = onOutlineChange;
  }, [onOutlineChange]);
  useEffect(() => {
    outlineRef.current = outline;
  }, [outline]);

  // One-time init.
  useEffect(() => {
    if (!containerRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { ...mapSources(), ...ANCHOR_SOURCES },
        layers: [...baseLayers(), ...ANCHOR_LAYERS],
      },
      center: [8.020798, 52.286366],
      zoom: 17,
    });
    m.addControl(new maplibregl.NavigationControl(), "bottom-right");
    m.once("style.load", () => setLoadedMap(m));
    mapRef.current = m;

    setupDrawInteraction(m, outlineRef, drawStageRef, (v) =>
      onOutlineRef.current(v),
    );

    // Place-anchor click handler — separate from the draw click handler
    // because the draw handler only fires when drawStageRef === "drawing".
    m.on("click", (e) => {
      if (stepRef.current !== "place-anchor") return;
      onAnchorRef.current({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    return () => {
      m.remove();
      mapRef.current = null;
      setLoadedMap(null);
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, []);

  // Cursor based on step.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (step === "place-anchor" || step === "trace-outline") {
      m.getCanvas().style.cursor = "crosshair";
    } else {
      m.getCanvas().style.cursor = "";
    }
  }, [step]);

  // Anchor marker. Create/update as anchor changes; recenter map first time.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (!anchor) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [anchor.lon, anchor.lat];
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "site-anchor-pin";
      el.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:#16A34A;border:3px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:grab;";
      const marker = new maplibregl.Marker({
        element: el,
        draggable: true,
        anchor: "center",
      })
        .setLngLat(lngLat)
        .addTo(m);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        onAnchorRef.current({ lat: ll.lat, lon: ll.lng });
      });
      markerRef.current = marker;
      m.flyTo({ center: lngLat, zoom: 18, duration: 600 });
    } else {
      markerRef.current.setLngLat(lngLat);
    }
  }, [anchor]);

  // Heading line — recompute on anchor or heading change.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const src = m.getSource("sn-heading") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!src) return;
    if (!anchor) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const endpoint = headingEndpoint(anchor.lat, anchor.lon, heading, 14);
    src.setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [[anchor.lon, anchor.lat], endpoint],
      },
      properties: {},
    });
  }, [anchor, heading]);

  // Outline updates — sync to draw sources when parent state changes.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    updateSources(m, outline);
  }, [outline]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <LayerControl map={loadedMap} />
    </div>
  );
}
