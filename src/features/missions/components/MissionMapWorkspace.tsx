import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { X, Crosshair } from "lucide-react";
import { loadBasemap } from "@/stores/mapView";
import { BasemapControl } from "@/components/map/BasemapControl";
import {
  MAP_SOURCES,
  baseLayers,
} from "@/components/map/BasemapControl.constants";
import { anchorFromSite, localToLatLon } from "../siteFrame";
import type { Site } from "@/api/client";
import type { StageDraft } from "./StageRow";

interface MissionMapWorkspaceProps {
  stages: StageDraft[];
  sites: Site[];
  addingIndex: number | null; // null = idle
  onMapClick: (lat: number, lon: number) => void;
  onCancelAddMode: () => void;
}

interface ResolvedWaypoint {
  stageIndex: number;
  waypointIndex: number;
  lngLat: [number, number];
}

function resolveWaypoints(
  stages: StageDraft[],
  sites: Site[],
): ResolvedWaypoint[] {
  const out: ResolvedWaypoint[] = [];
  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    for (let wi = 0; wi < stage.waypoints.length; wi++) {
      const w = stage.waypoints[wi];
      let coord: [number, number] | null = null;
      if (stage.frame === "wgs84") {
        const lat = parseFloat(w.lat);
        const lon = parseFloat(w.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          coord = [lon, lat];
        }
      } else if (stage.frame === "site_local" && stage.site_id) {
        const x = parseFloat(w.x);
        const y = parseFloat(w.y);
        const site = sites.find((s) => s.site_id === stage.site_id);
        if (site && Number.isFinite(x) && Number.isFinite(y)) {
          const ll = localToLatLon(anchorFromSite(site), x, y);
          coord = [ll.lon, ll.lat];
        }
      }
      if (coord) {
        out.push({ stageIndex: si, waypointIndex: wi, lngLat: coord });
      }
    }
  }
  return out;
}

const SOURCES: Record<string, maplibregl.SourceSpecification> = {
  ...MAP_SOURCES,
  "mn-waypoints": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  "mn-paths": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
};

const OVERLAY_LAYERS: maplibregl.LayerSpecification[] = [
  {
    id: "mn-paths-other",
    type: "line",
    source: "mn-paths",
    filter: ["!=", ["get", "focused"], true],
    paint: {
      "line-color": "#94A3B8",
      "line-width": 2,
      "line-dasharray": [2, 2],
    },
  },
  {
    id: "mn-paths-focused",
    type: "line",
    source: "mn-paths",
    filter: ["==", ["get", "focused"], true],
    paint: { "line-color": "#16A34A", "line-width": 3 },
  },
  {
    id: "mn-waypoints-other",
    type: "circle",
    source: "mn-waypoints",
    filter: ["!=", ["get", "focused"], true],
    paint: {
      "circle-radius": 4,
      "circle-color": "#94A3B8",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5,
    },
  },
  {
    id: "mn-waypoints-focused",
    type: "circle",
    source: "mn-waypoints",
    filter: ["==", ["get", "focused"], true],
    paint: {
      "circle-radius": 6,
      "circle-color": "#16A34A",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
  },
];

export function MissionMapWorkspace({
  stages,
  sites,
  addingIndex,
  onMapClick,
  onCancelAddMode,
}: MissionMapWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const clickHandlerRef = useRef(onMapClick);

  useEffect(() => {
    clickHandlerRef.current = onMapClick;
  }, [onMapClick]);

  // One-time map init.
  useEffect(() => {
    if (!containerRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: SOURCES,
        layers: [...baseLayers(loadBasemap()), ...OVERLAY_LAYERS],
      },
      center: [8.020798, 52.286366],
      zoom: 14,
    });
    m.addControl(new maplibregl.NavigationControl(), "bottom-right");
    m.on("click", (e) => {
      clickHandlerRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, []);

  // Cursor + map data updates.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.getCanvas().style.cursor = addingIndex !== null ? "crosshair" : "";

    const resolved = resolveWaypoints(stages, sites);
    const pointFeatures = resolved.map((r) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: r.lngLat },
      properties: {
        focused: r.stageIndex === addingIndex,
        stageIndex: r.stageIndex,
      },
    }));

    // Group by stage for paths.
    const byStage = new Map<number, [number, number][]>();
    for (const r of resolved) {
      if (!byStage.has(r.stageIndex)) byStage.set(r.stageIndex, []);
      byStage.get(r.stageIndex)!.push(r.lngLat);
    }
    const lineFeatures = Array.from(byStage.entries())
      .filter(([, coords]) => coords.length >= 2)
      .map(([si, coords]) => ({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: coords },
        properties: { focused: si === addingIndex, stageIndex: si },
      }));

    const wpSource = m.getSource("mn-waypoints") as
      | maplibregl.GeoJSONSource
      | undefined;
    wpSource?.setData({ type: "FeatureCollection", features: pointFeatures });

    const pathSource = m.getSource("mn-paths") as
      | maplibregl.GeoJSONSource
      | undefined;
    pathSource?.setData({ type: "FeatureCollection", features: lineFeatures });
  }, [stages, sites, addingIndex]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <BasemapControl mapRef={mapRef} />
      {addingIndex !== null && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white border border-primary rounded-md shadow-md flex items-center gap-2 px-3 py-1.5">
          <Crosshair className="w-3.5 h-3.5 text-primary" />
          <span className="text-ui-sm text-t1">
            Click map to add waypoint to{" "}
            <span className="font-semibold">Stage {addingIndex + 1}</span>
          </span>
          <button
            type="button"
            onClick={onCancelAddMode}
            aria-label="Cancel"
            className="text-t3 hover:text-t1 transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
