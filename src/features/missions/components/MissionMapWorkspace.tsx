import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Source, useMap } from "@vis.gl/react-maplibre";
import type {
  CircleLayerSpecification,
  FilterSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { FeatureCollection, LineString, Point } from "geojson";
import { X, Crosshair } from "lucide-react";
import { NO_FIELDS, useFields } from "@/api/fields";
import { isSettled } from "@/api/settled";
import { FieldsLayer } from "@/components/map/FieldsLayer";
import {
  bboxOfPoints,
  fieldBbox,
  type LngLatBox,
} from "@/components/map/fieldUtils";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { RobotsLayer } from "@/features/fleet/RobotsLayer";
import { useFleet } from "@/stores/fleet";
import { anchorFromSite, localToLatLon } from "../siteFrame";
import {
  coverageLines,
  mainlandFeatures,
  MAINLAND_PAINT,
} from "./coverageLayers";
import type { CoverageStage, Field, Site } from "@/api/client";
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

function fieldsOf(stages: StageDraft[], fields: Field[]): Field[] {
  const ids = new Set(
    stages.flatMap((s) =>
      s.kind === "coverage" && s.field_id ? [s.field_id] : [],
    ),
  );
  return fields.filter((f) => ids.has(f.id));
}

interface Shape {
  key: string;
  bounds: LngLatBox | null;
}

const fieldKey = (fieldId: string) => `field:${fieldId}`;
const planKey = (stageId: string) => `plan:${stageId}`;

function shapesOf(planned: CoverageStage[], fields: Field[]): Shape[] {
  return [
    ...fields.map((f) => ({
      key: fieldKey(f.id),
      bounds: fieldBbox(f.geometry),
    })),
    ...planned.map((p) => ({
      key: planKey(p.stage_id),
      bounds: bboxOfPoints(coverageLines([p]).flat()),
    })),
  ];
}

function shapeKeysOf(stages: StageDraft[]): string[] {
  return stages.flatMap((s) =>
    s.kind !== "coverage"
      ? []
      : [
          ...(s.field_id ? [fieldKey(s.field_id)] : []),
          ...(s.planned ? [planKey(s.planned.stage_id)] : []),
        ],
  );
}

function contentBounds(stages: StageDraft[], sites: Site[], fields: Field[]) {
  return bboxOfPoints([
    ...resolveWaypoints(stages, sites).map((r) => r.lngLat),
    ...shapesOf(plansOf(stages), fieldsOf(stages, fields)).flatMap(
      (s) => s.bounds ?? [],
    ),
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

// Brings the map to a field or plan that has just appeared and leaves it alone otherwise.
function FitNewShapes({
  shapes,
  initial,
}: {
  shapes: Shape[];
  initial: string[];
}) {
  const map = useMap().current;
  const previous = useRef(new Set(initial));

  useEffect(() => {
    if (!map) return;
    const fresh = shapes.filter((s) => !previous.current.has(s.key));
    previous.current = new Set(shapes.map((s) => s.key));
    const bounds = bboxOfPoints(fresh.flatMap((s) => s.bounds ?? []));
    if (bounds)
      map.fitBounds(bounds, { padding: 40, duration: 300, maxZoom: 19 });
  }, [map, shapes]);

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
  const fieldsQuery = useFields();
  const allFields = fieldsQuery.data ?? NO_FIELDS;
  const openingBounds = useMemo(
    () => contentBounds(opening, sites, allFields),
    [opening, sites, allFields],
  );
  const openingNeedsFields = opening.some((s) => s.kind === "coverage");
  const planned = useMemo(() => plansOf(stages), [stages]);
  const fields = useMemo(
    () => fieldsOf(stages, allFields),
    [stages, allFields],
  );
  const shapes = useMemo(() => shapesOf(planned, fields), [planned, fields]);
  // The opening view already shows what the editor opened with, so only later choices move the map.
  const shownAtOpening = useMemo(() => shapeKeysOf(opening), [opening]);

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
  const empty = waypoints.features.length === 0 && shapes.length === 0;

  return (
    <div className="relative h-full w-full">
      <LeitstandMap
        view={
          openingBounds
            ? { bounds: openingBounds, padding: 40, maxZoom: 19 }
            : undefined
        }
        ready={
          (opening.length === 0 || sitesReady) &&
          (!openingNeedsFields || isSettled(fieldsQuery))
        }
        cursor={addingIndex !== null ? "crosshair" : undefined}
        onClick={(e) => onMapClick(e.lngLat.lat, e.lngLat.lng)}
      >
        <FieldsLayer fields={fields} />
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
        <FitNewShapes shapes={shapes} initial={shownAtOpening} />
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
