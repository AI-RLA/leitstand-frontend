import { useEffect, useMemo, useState } from "react";
import { Layer, Marker, Source, useMap } from "@vis.gl/react-maplibre";
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FilterSpecification,
  LineLayerSpecification,
  LngLatBoundsLike,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { FeatureCollection, LineString, Point } from "geojson";
import { NO_FIELDS } from "@/api/fields";
import { RobotsLayer } from "@/features/fleet/RobotsLayer";
import { bboxOfPoints, fieldBbox } from "@/components/map/fieldUtils";
import { FieldsLayer } from "@/components/map/FieldsLayer";
import { FitBounds } from "@/components/map/FitBounds";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { anchorFromSite, localToLatLon, type SiteAnchor } from "../siteFrame";
import { MAINLAND_PAINT, mainlandFeatures } from "./coverageLayers";
import { stageDrivenWaypoints, stageWaypoints } from "../stageWaypoints";
import type {
  CoverageStage,
  Field,
  RunState,
  Site,
  Stage,
  StageStateView,
  RunSiteAnchor,
} from "@/api/client";

interface MissionPathPreviewProps {
  /** The definition's stages, or a run's frozen ones. */
  stages: Stage[];
  /** The map fits once per key, and null holds the fit until the data it frames has loaded. */
  fitKey: string | null;
  state: RunState | null;
  sites: Site[];
  /**
   * The site frames this run was dispatched with, preferred over the current sites, so a
   * finished run is not redrawn when a site moves and still draws after one is deleted.
   */
  siteAnchors?: Record<string, RunSiteAnchor> | null;
  /** Boundaries the coverage stages were planned over, drawn under the path for comparison. */
  fields?: Field[];
  /** The robot drawn in full, every other online robot is drawn muted. */
  robotId?: string | null;
}

interface StagePath {
  stageIndex: number;
  status: StageStateView["status"] | "PENDING";
  /** The line actually driven, turns included. [lng, lat] */
  line: [number, number][];
  /** The waypoints the plan names, which is far fewer points than the line is sampled at. */
  marks: [number, number][];
}

const STATUS_COLOR = {
  FINISHED: "#16A34A",
  RUNNING: "#16A34A",
  INITIALIZING: "#16A34A",
  PAUSED: "#F59E0B",
  FAILED: "#EF4444",
} as const;
const STATUS_COLOR_PENDING = "#94A3B8";
const ENDPOINT_DARK = "#475569";

function statusColor(status: StagePath["status"]): string {
  return status in STATUS_COLOR
    ? STATUS_COLOR[status as keyof typeof STATUS_COLOR]
    : STATUS_COLOR_PENDING;
}

const STATUS_MATCH: ExpressionSpecification = [
  "match",
  ["get", "status"],
  "FINISHED",
  STATUS_COLOR.FINISHED,
  "RUNNING",
  STATUS_COLOR.RUNNING,
  "INITIALIZING",
  STATUS_COLOR.INITIALIZING,
  "PAUSED",
  STATUS_COLOR.PAUSED,
  "FAILED",
  STATUS_COLOR.FAILED,
  STATUS_COLOR_PENDING,
];

type Waypoint = ReturnType<typeof stageWaypoints>[number];

function anchorFor(
  siteId: string,
  sites: Site[],
  frozen: Record<string, RunSiteAnchor> | null | undefined,
): SiteAnchor | null {
  const asDispatched = frozen?.[siteId];
  if (asDispatched) {
    return {
      lat: asDispatched.anchor_lat,
      lon: asDispatched.anchor_lon,
      headingDeg: asDispatched.anchor_heading_deg,
    };
  }
  const site = sites.find((s) => s.site_id === siteId);
  return site ? anchorFromSite(site) : null;
}

function toCoords(
  waypoints: Waypoint[],
  sites: Site[],
  frozen?: Record<string, RunSiteAnchor> | null,
): [number, number][] {
  const coords: [number, number][] = [];
  for (const w of waypoints) {
    if (w.kind === "wgs84") {
      if (Number.isFinite(w.lat) && Number.isFinite(w.lon)) {
        coords.push([w.lon, w.lat]);
      }
    } else if (w.kind === "site_local") {
      const anchor = anchorFor(w.site_id, sites, frozen);
      if (anchor) {
        const ll = localToLatLon(anchor, w.x, w.y);
        coords.push([ll.lon, ll.lat]);
      }
    }
  }
  return coords;
}

function resolveStagePaths(
  stages: Stage[],
  liveStates: StageStateView[] | undefined,
  sites: Site[],
  frozen?: Record<string, RunSiteAnchor> | null,
): StagePath[] {
  // Join runtime by stage_id (the live frame's order need not match the definition).
  const byId = new Map<string, StageStateView>(
    (liveStates ?? []).map((s) => [s.stage_id, s]),
  );
  const out: StagePath[] = [];
  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    const marks = toCoords(stageWaypoints(stage), sites, frozen);
    // A coverage stage's swaths name only the ends of each pass, so joining those alone draws
    // straight chords where the machine will drive curves, and hides the swing outside the
    // boundary that the turn radius forces. The whole route, turns included, is the line driven.
    const line =
      stage.kind === "coverage"
        ? toCoords(stageDrivenWaypoints(stage), sites, frozen)
        : marks;
    out.push({
      stageIndex: si,
      status: byId.get(stage.stage_id)?.status ?? "PENDING",
      line,
      marks,
    });
  }
  return out;
}

/**
 * Locate the mission's first and last waypoint, keyed `"<stageIndex>:<waypointIndex>"`.
 *
 * The route runs across stages, so the endpoints are the mission's rather than each stage's.
 * Stages resolving to no coordinates cannot claim one, and a lone waypoint is a start only.
 */
function endpointKeys(paths: StagePath[]): {
  start: string | null;
  end: string | null;
} {
  const drawn = paths.filter((p) => p.marks.length > 0);
  if (drawn.length === 0) return { start: null, end: null };
  const first = drawn[0];
  const last = drawn[drawn.length - 1];
  const start = `${first.stageIndex}:0`;
  const end = `${last.stageIndex}:${last.marks.length - 1}`;
  return { start, end: end === start ? null : end };
}

function boundsOf(
  paths: StagePath[],
  fields: Field[],
): LngLatBoundsLike | null {
  // Framing both together is what makes a misplaced path visible: a path drawn far from the field
  // it claims to cover zooms the view out until the gap is the obvious thing on screen, where
  // fitting the path alone would show a plausible-looking route and no field at all.
  return bboxOfPoints([
    ...paths.flatMap((p) => p.line),
    ...fields.flatMap((f) => fieldBbox(f.geometry)),
  ]);
}

const ROUND = { "line-cap": "round", "line-join": "round" } as const;
// A line has no stroke of its own, and orthophotos give a thin one nothing to read against. A soft
// wider line beneath separates it from grass, tarmac and shadow alike.
const CASING_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#fff",
  "line-width": 6,
  "line-opacity": 0.5,
  "line-blur": 1,
};
const PENDING_FILTER: FilterSpecification = [
  "in",
  ["get", "status"],
  ["literal", ["PENDING", "WAITING", "CANCELLED", "SKIPPED"]],
];
const PENDING_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#64748B",
  "line-width": 2.5,
  "line-dasharray": [3, 2],
};
const FINISHED_FILTER: FilterSpecification = [
  "==",
  ["get", "status"],
  "FINISHED",
];
const FINISHED_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#16A34A",
  "line-width": 3,
  "line-opacity": 0.6,
};
const RUNNING_FILTER: FilterSpecification = [
  "in",
  ["get", "status"],
  ["literal", ["RUNNING", "INITIALIZING", "PAUSED"]],
];
const RUNNING_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#16A34A",
  "line-width": 4,
};
const FAILED_FILTER: FilterSpecification = ["==", ["get", "status"], "FAILED"];
const FAILED_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#EF4444",
  "line-width": 3,
};
const WAYPOINT_PAINT: CircleLayerSpecification["paint"] = {
  "circle-radius": 4,
  "circle-color": STATUS_MATCH,
  "circle-stroke-color": "#fff",
  "circle-stroke-width": 1.5,
};
const ENDPOINT_FILTER: FilterSpecification = [
  "in",
  ["get", "role"],
  ["literal", ["start", "end"]],
];
const IS_END: ExpressionSpecification = ["==", ["get", "role"], "end"];
// Light origin, dark destination, as a route reads on any map. Tone rather than size tells them
// apart, so the ends stay the scale of the waypoints they belong to.
const ENDPOINT_PAINT: CircleLayerSpecification["paint"] = {
  "circle-radius": 5,
  "circle-color": ["case", IS_END, ENDPOINT_DARK, "#fff"],
  "circle-stroke-color": ["case", IS_END, "#fff", STATUS_MATCH],
  "circle-stroke-width": ["case", IS_END, 1.5, 2],
};
const ENDPOINT_HIT = "mp-endpoint-hit";
// Wider than the mark it belongs to, because a 5px dot is hard to point at.
const ENDPOINT_HIT_PAINT: CircleLayerSpecification["paint"] = {
  "circle-radius": 13,
  "circle-color": "#fff",
  "circle-opacity": 0.01,
};
// The label must never take the pointer from the endpoint it describes.
const NO_POINTER = { pointerEvents: "none" } as const;

interface HoveredEnd {
  role: "start" | "end";
  status: StagePath["status"];
  lngLat: [number, number];
}

/**
 * Show the label of the endpoint under the pointer.
 *
 * HTML rather than a symbol layer, because the style carries no glyph source and text would not
 * draw. White is the only fill that holds against both the orthophoto and the street basemap.
 */
function EndpointLabel() {
  const map = useMap().current?.getMap();
  const [hovered, setHovered] = useState<HoveredEnd | null>(null);

  useEffect(() => {
    if (!map) return;
    const show = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const role = feature.properties?.role;
      if (role !== "start" && role !== "end") return;
      const [lng, lat] = feature.geometry.coordinates;
      setHovered((prev) =>
        prev !== null &&
        prev.role === role &&
        prev.lngLat[0] === lng &&
        prev.lngLat[1] === lat &&
        prev.status === feature.properties?.status
          ? prev
          : { role, status: feature.properties?.status, lngLat: [lng, lat] },
      );
    };
    const hide = () => setHovered(null);
    map.on("mousemove", ENDPOINT_HIT, show);
    map.on("mouseleave", ENDPOINT_HIT, hide);
    return () => {
      map.off("mousemove", ENDPOINT_HIT, show);
      map.off("mouseleave", ENDPOINT_HIT, hide);
    };
  }, [map]);

  if (!hovered) return null;
  return (
    <Marker
      longitude={hovered.lngLat[0]}
      latitude={hovered.lngLat[1]}
      anchor="bottom"
      offset={[0, -10]}
      style={NO_POINTER}
    >
      <div className="flex items-center gap-[5px] px-1.5 py-0.5 rounded bg-white border border-border shadow-[0_1px_3px_rgba(15,23,42,0.18)] whitespace-nowrap text-[10px] leading-none font-semibold tracking-[0.06em] uppercase text-[#475569]">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background:
              hovered.role === "end"
                ? ENDPOINT_DARK
                : statusColor(hovered.status),
          }}
        />
        <span>{hovered.role === "start" ? "Start" : "End"}</span>
      </div>
    </Marker>
  );
}

export function MissionPathPreview({
  stages,
  fitKey,
  state,
  sites,
  siteAnchors,
  fields = NO_FIELDS,
  robotId = null,
}: MissionPathPreviewProps) {
  // The mainland comes with the stage rather than from the field, because the field can be
  // edited after a plan is made.
  const mainland = useMemo(
    () =>
      mainlandFeatures(
        stages.filter((s): s is CoverageStage => s.kind === "coverage"),
      ),
    [stages],
  );

  const paths = useMemo(
    () => resolveStagePaths(stages, state?.stage_states, sites, siteAnchors),
    [stages, state, sites, siteAnchors],
  );

  const { lines, points } = useMemo(() => {
    const lines: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: paths
        .filter((p) => p.line.length >= 2)
        .map((p) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: p.line },
          properties: { stageIndex: p.stageIndex, status: p.status },
        })),
    };
    const ends = endpointKeys(paths);
    const points: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: paths.flatMap((p) =>
        p.marks.map((c, wi) => {
          const key = `${p.stageIndex}:${wi}`;
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: c },
            properties: {
              stageIndex: p.stageIndex,
              waypointIndex: wi,
              status: p.status,
              role:
                key === ends.start ? "start" : key === ends.end ? "end" : "mid",
            },
          };
        }),
      ),
    };
    return { lines, points };
  }, [paths]);

  const bounds = useMemo(() => boundsOf(paths, fields), [paths, fields]);

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden border border-border">
      <LeitstandMap
        view={{ center: [8.020798, 52.286366], zoom: 15 }}
        navigation={{ showCompass: false }}
      >
        <FieldsLayer fields={fields} />
        <Source id="mp-mainland" type="geojson" data={mainland}>
          <Layer id="mp-mainland-outline" type="line" paint={MAINLAND_PAINT} />
        </Source>
        <Source id="mp-paths" type="geojson" data={lines}>
          <Layer
            id="mp-path-casing"
            type="line"
            layout={ROUND}
            paint={CASING_PAINT}
          />
          <Layer
            id="mp-path-pending"
            type="line"
            filter={PENDING_FILTER}
            paint={PENDING_PAINT}
          />
          <Layer
            id="mp-path-finished"
            type="line"
            filter={FINISHED_FILTER}
            paint={FINISHED_PAINT}
          />
          <Layer
            id="mp-path-running"
            type="line"
            filter={RUNNING_FILTER}
            paint={RUNNING_PAINT}
          />
          <Layer
            id="mp-path-failed"
            type="line"
            filter={FAILED_FILTER}
            paint={FAILED_PAINT}
          />
        </Source>
        <Source id="mp-waypoints" type="geojson" data={points}>
          <Layer id="mp-waypoints" type="circle" paint={WAYPOINT_PAINT} />
          <Layer
            id="mp-waypoint-endpoints"
            type="circle"
            filter={ENDPOINT_FILTER}
            paint={ENDPOINT_PAINT}
          />
          <Layer
            id={ENDPOINT_HIT}
            type="circle"
            filter={ENDPOINT_FILTER}
            paint={ENDPOINT_HIT_PAINT}
          />
        </Source>
        <RobotsLayer fullIds={robotId ? [robotId] : []} />
        <EndpointLabel />
        {/* Past zoom 19 both basemaps scale up their last tiles, which is soft but keeps a small field from shrinking to a stamp. */}
        <FitBounds
          bounds={bounds}
          fitKey={fitKey}
          padding={30}
          maxZoom={20}
          duration={0}
        />
      </LeitstandMap>
    </div>
  );
}
