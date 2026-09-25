import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Source, useMap } from "@vis.gl/react-maplibre";
import type {
  CircleLayerSpecification,
  FilterSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { FeatureCollection, LineString, Point } from "geojson";
import { X, Crosshair } from "lucide-react";
import { bboxOfPoints } from "@/components/map/fieldUtils";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { RobotsLayer } from "@/features/fleet/RobotsLayer";
import { useFleet } from "@/stores/fleet";
import { anchorFromSite, localToLatLon } from "../siteFrame";
import {
  coverageBounds,
  coverageLines,
  mainlandFeatures,
  MAINLAND_PAINT,
} from "./coverageLayers";
import type { CoverageStage, Site } from "@/api/client";
import type { StageDraft } from "./StageRow";

interface MissionMapWorkspaceProps {
  stages: StageDraft[];
  sites: Site[];
  // Site-local waypoints resolve only once the sites have loaded.
  sitesReady: boolean;
  // The robot chosen for the mission, drawn in full while the others are muted.
  robotId: string | null;
  onRobotClick: (robotId: string) => void;
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

function plansOf(stages: StageDraft[]): CoverageStage[] {
  return stages.flatMap((s) =>
    s.kind === "coverage" && s.planned ? [s.planned] : [],
  );
}

function contentBounds(stages: StageDraft[], sites: Site[]) {
  return bboxOfPoints([
    ...resolveWaypoints(stages, sites).map((r) => r.lngLat),
    ...coverageLines(plansOf(stages)).flat(),
  ]);
}

const FOCUSED: FilterSpecification = ["==", ["get", "focused"], true];
const NOT_FOCUSED: FilterSpecification = ["!=", ["get", "focused"], true];
const ROUND = { "line-cap": "round", "line-join": "round" } as const;
const COVERAGE_CASING_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#fff",
  "line-width": 5,
  "line-opacity": 0.5,
};
const COVERAGE_LINE_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#16A34A",
  "line-width": 2,
};
const PATH_OTHER_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#94A3B8",
  "line-width": 2,
  "line-dasharray": [2, 2],
};
const PATH_FOCUSED_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#16A34A",
  "line-width": 3,
};
const WAYPOINT_OTHER_PAINT: CircleLayerSpecification["paint"] = {
  "circle-radius": 4,
  "circle-color": "#94A3B8",
  "circle-stroke-color": "#fff",
  "circle-stroke-width": 1.5,
};
const WAYPOINT_FOCUSED_PAINT: CircleLayerSpecification["paint"] = {
  "circle-radius": 6,
  "circle-color": "#16A34A",
  "circle-stroke-color": "#fff",
  "circle-stroke-width": 2,
};

// Brings the map to plans the operator has not seen yet and leaves it alone for plans already shown.
function FitNewPlans({
  planned,
  initial,
}: {
  planned: CoverageStage[];
  initial: CoverageStage[];
}) {
  const map = useMap().current;
  const shown = useRef(new Set(initial.map((p) => p.stage_id)));

  useEffect(() => {
    if (!map) return;
    const fresh = planned.filter((p) => !shown.current.has(p.stage_id));
    if (fresh.length === 0) return;
    const bounds = coverageBounds(coverageLines(fresh));
    if (bounds)
      map.fitBounds(bounds, { padding: 40, duration: 300, maxZoom: 19 });
    for (const p of planned) shown.current.add(p.stage_id);
  }, [map, planned]);

  return null;
}

// Brings a newly chosen robot into view while the mission has nothing on the map yet.
function BringRobotIntoView({
  robotId,
  sitesReady,
  empty,
}: {
  robotId: string | null;
  sitesReady: boolean;
  empty: boolean;
}) {
  const map = useMap().current;
  const handled = useRef<string | null>(null);

  // A choice waits while the sites load, and is spent once seen, so later edits never fly the map.
  useEffect(() => {
    if (!sitesReady || robotId === handled.current) return;
    handled.current = robotId;
    if (!map || !empty || !robotId) return;
    const pose = useFleet.getState().robots[robotId]?.pose;
    if (!pose || map.getBounds().contains([pose.lon, pose.lat])) return;
    map.flyTo({
      center: [pose.lon, pose.lat],
      zoom: Math.max(map.getZoom(), 16),
    });
  }, [map, robotId, sitesReady, empty]);

  return null;
}

export function MissionMapWorkspace({
  stages,
  sites,
  sitesReady,
  robotId,
  onRobotClick,
  addingIndex,
  onMapClick,
  onCancelAddMode,
}: MissionMapWorkspaceProps) {
  // The stages the editor opened with, so the map fits to them once and never to later edits.
  const [opening] = useState(stages);
  const openingBounds = useMemo(
    () => contentBounds(opening, sites),
    [opening, sites],
  );
  const openingPlans = useMemo(() => plansOf(opening), [opening]);
  const planned = useMemo(() => plansOf(stages), [stages]);

  const { waypoints, paths } = useMemo(() => {
    const resolved = resolveWaypoints(stages, sites);
    const waypoints: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: resolved.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: r.lngLat },
        properties: {
          focused: r.stageIndex === addingIndex,
          stageIndex: r.stageIndex,
        },
      })),
    };
    const byStage = new Map<number, [number, number][]>();
    for (const r of resolved) {
      if (!byStage.has(r.stageIndex)) byStage.set(r.stageIndex, []);
      byStage.get(r.stageIndex)!.push(r.lngLat);
    }
    const paths: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: Array.from(byStage.entries())
        .filter(([, coords]) => coords.length >= 2)
        .map(([si, coords]) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: { focused: si === addingIndex, stageIndex: si },
        })),
    };
    return { waypoints, paths };
  }, [stages, sites, addingIndex]);

  const { coverage, mainland } = useMemo(() => {
    const coverage: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: coverageLines(planned)
        .filter((line) => line.length >= 2)
        .map((line) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: line },
          properties: {},
        })),
    };
    return { coverage, mainland: mainlandFeatures(planned) };
  }, [planned]);
  const empty =
    waypoints.features.length === 0 && coverage.features.length === 0;

  return (
    <div className="relative h-full w-full">
      <LeitstandMap
        view={
          openingBounds
            ? { bounds: openingBounds, padding: 40, maxZoom: 19 }
            : undefined
        }
        ready={opening.length === 0 || sitesReady}
        cursor={addingIndex !== null ? "crosshair" : undefined}
        onClick={(e) => onMapClick(e.lngLat.lat, e.lngLat.lng)}
      >
        <Source id="mn-mainland" type="geojson" data={mainland}>
          <Layer id="mn-mainland-outline" type="line" paint={MAINLAND_PAINT} />
        </Source>
        <Source id="mn-coverage" type="geojson" data={coverage}>
          <Layer
            id="mn-coverage-casing"
            type="line"
            layout={ROUND}
            paint={COVERAGE_CASING_PAINT}
          />
          <Layer
            id="mn-coverage-line"
            type="line"
            layout={ROUND}
            paint={COVERAGE_LINE_PAINT}
          />
        </Source>
        <Source id="mn-paths" type="geojson" data={paths}>
          <Layer
            id="mn-paths-other"
            type="line"
            filter={NOT_FOCUSED}
            paint={PATH_OTHER_PAINT}
          />
          <Layer
            id="mn-paths-focused"
            type="line"
            filter={FOCUSED}
            paint={PATH_FOCUSED_PAINT}
          />
        </Source>
        <Source id="mn-waypoints" type="geojson" data={waypoints}>
          <Layer
            id="mn-waypoints-other"
            type="circle"
            filter={NOT_FOCUSED}
            paint={WAYPOINT_OTHER_PAINT}
          />
          <Layer
            id="mn-waypoints-focused"
            type="circle"
            filter={FOCUSED}
            paint={WAYPOINT_FOCUSED_PAINT}
          />
        </Source>
        <FitNewPlans planned={planned} initial={openingPlans} />
        <BringRobotIntoView
          robotId={robotId}
          sitesReady={sitesReady}
          empty={empty}
        />
        <RobotsLayer
          fullIds={robotId ? [robotId] : []}
          // While adding waypoints a click on a robot places the waypoint there instead.
          onRobotClick={addingIndex === null ? onRobotClick : undefined}
        />
      </LeitstandMap>
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
