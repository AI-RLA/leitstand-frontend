import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { X, Crosshair } from "lucide-react";
import { LayerControl } from "@/components/map/LayerControl";
import {
  mapSources,
  baseLayers,
} from "@/components/map/BasemapControl.constants";
import { anchorFromSite, localToLatLon } from "../siteFrame";
import {
  coverageBounds,
  coverageLines,
  mainlandFeatures,
  mainlandLayer,
} from "./coverageLayers";
import type { CoverageStage, Site } from "@/api/client";
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
    if (stage.kind !== "navigation") continue;
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
  "mn-waypoints": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  "mn-paths": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  "mn-mainland": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  "mn-coverage": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
};

const OVERLAY_LAYERS: maplibregl.LayerSpecification[] = [
  mainlandLayer("mn-mainland-outline", "mn-mainland"),
  {
    id: "mn-coverage-casing",
    type: "line",
    source: "mn-coverage",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#fff", "line-width": 5, "line-opacity": 0.5 },
  },
  {
    id: "mn-coverage-line",
    type: "line",
    source: "mn-coverage",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#16A34A", "line-width": 2 },
  },
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
  const [loadedMap, setLoadedMap] = useState<maplibregl.Map | null>(null);
  const clickHandlerRef = useRef(onMapClick);
  // Plans already shown, by stage id; a plan the operator has not seen yet brings the map to it.
  const shownPlansRef = useRef<Set<string>>(new Set());

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
        sources: { ...mapSources(), ...SOURCES },
        layers: [...baseLayers(), ...OVERLAY_LAYERS],
      },
      center: [8.020798, 52.286366],
      zoom: 14,
    });
    m.addControl(new maplibregl.NavigationControl(), "bottom-right");
    m.on("click", (e) => {
      clickHandlerRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    m.once("style.load", () => setLoadedMap(m));
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
      setLoadedMap(null);
    };
  }, []);

  // Cursor + map data updates.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.getCanvas().style.cursor = addingIndex !== null ? "crosshair" : "";

    // False until the style has been parsed and the sources exist; the stages loaded from a
    // mission usually arrive before that, and would otherwise stay undrawn until the next edit.
    const apply = () => {
      const source = (id: string) =>
        m.getSource(id) as maplibregl.GeoJSONSource | undefined;
      const wpSource = source("mn-waypoints");
      const pathSource = source("mn-paths");
      const coverageSource = source("mn-coverage");
      const mainlandSource = source("mn-mainland");
      if (!wpSource || !pathSource || !coverageSource || !mainlandSource) {
        return false;
      }

      const resolved = resolveWaypoints(stages, sites);
      wpSource.setData({
        type: "FeatureCollection",
        features: resolved.map((r) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: r.lngLat },
          properties: {
            focused: r.stageIndex === addingIndex,
            stageIndex: r.stageIndex,
          },
        })),
      });

      const byStage = new Map<number, [number, number][]>();
      for (const r of resolved) {
        if (!byStage.has(r.stageIndex)) byStage.set(r.stageIndex, []);
        byStage.get(r.stageIndex)!.push(r.lngLat);
      }
      pathSource.setData({
        type: "FeatureCollection",
        features: Array.from(byStage.entries())
          .filter(([, coords]) => coords.length >= 2)
          .map(([si, coords]) => ({
            type: "Feature" as const,
            geometry: { type: "LineString" as const, coordinates: coords },
            properties: { focused: si === addingIndex, stageIndex: si },
          })),
      });

      const planned: CoverageStage[] = stages.flatMap((s) =>
        s.kind === "coverage" && s.planned ? [s.planned] : [],
      );
      const lines = coverageLines(planned);
      coverageSource.setData({
        type: "FeatureCollection",
        features: lines
          .filter((line) => line.length >= 2)
          .map((line) => ({
            type: "Feature" as const,
            geometry: { type: "LineString" as const, coordinates: line },
            properties: {},
          })),
      });
      mainlandSource.setData(mainlandFeatures(planned));

      const freshLines = lines.filter(
        (_line, i) => !shownPlansRef.current.has(planned[i].stage_id),
      );
      if (freshLines.length > 0) {
        const b = coverageBounds(freshLines);
        if (b) m.fitBounds(b, { padding: 40, duration: 300, maxZoom: 19 });
        for (const p of planned) shownPlansRef.current.add(p.stage_id);
      }
      return true;
    };

    if (apply()) return;
    const onStyleData = () => {
      if (apply()) m.off("styledata", onStyleData);
    };
    m.on("styledata", onStyleData);
    return () => {
      m.off("styledata", onStyleData);
    };
  }, [stages, sites, addingIndex]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <LayerControl map={loadedMap} />
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
