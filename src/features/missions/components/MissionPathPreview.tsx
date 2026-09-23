import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadBasemap } from "@/stores/mapView";
import {
  MAP_SOURCES,
  baseLayers,
} from "@/components/map/BasemapControl.constants";
import { BasemapControl } from "@/components/map/BasemapControl";
import { useFleet } from "@/stores/fleet";
import {
  bboxOfPoints,
  fieldBbox,
  toFieldGeoJSON,
} from "@/components/map/fieldUtils";
import { anchorFromSite, localToLatLon, type SiteAnchor } from "../siteFrame";
import { mainlandFeatures, mainlandLayer } from "./coverageLayers";
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
  /** Changes re-arm the one-time fit, so a new mission or run gets its own viewport. */
  fitKey: string;
  state: RunState | null;
  sites: Site[];
  /**
   * The site frames this run was dispatched with, preferred over the current sites, so a
   * finished run is not redrawn when a site moves and still draws after one is deleted.
   */
  siteAnchors?: Record<string, RunSiteAnchor> | null;
  /** Boundaries the coverage stages were planned over, drawn under the path for comparison. */
  fields?: Field[];
  /** The robot whose live pose to draw; null draws none. */
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

// Derived from the layer spec rather than imported: the expression type lives in the style-spec
// package, which maplibre-gl depends on but does not re-export.
type CircleColor = NonNullable<
  Extract<maplibregl.LayerSpecification, { type: "circle" }>["paint"]
>["circle-color"];

const STATUS_MATCH: CircleColor = [
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
): maplibregl.LngLatBoundsLike | null {
  // Framing both together is what makes a misplaced path visible: a path drawn far from the field
  // it claims to cover zooms the view out until the gap is the obvious thing on screen, where
  // fitting the path alone would show a plausible-looking route and no field at all.
  return bboxOfPoints([
    ...paths.flatMap((p) => p.line),
    ...fields.flatMap((f) => fieldBbox(f.geometry)),
  ]);
}

// Listed before the path layers so the boundary renders beneath them.
const FIELD_LAYERS: maplibregl.LayerSpecification[] = [
  {
    id: "mp-field-fill",
    type: "fill",
    source: "mp-field",
    paint: { "fill-color": "#16A34A", "fill-opacity": 0.1 },
  },
  {
    id: "mp-field-outline",
    type: "line",
    source: "mp-field",
    paint: { "line-color": "#16A34A", "line-width": 1.5, "line-opacity": 0.6 },
  },
  mainlandLayer("mp-mainland-outline", "mp-mainland"),
];

const PATH_LAYERS: maplibregl.LayerSpecification[] = [
  // Casing under every path. A line has no stroke of its own, and orthophotos give a thin one
  // nothing to read against; a soft wider line beneath separates it from grass, tarmac and shadow
  // alike, where widening or brightening the path itself would only work over dark ground.
  {
    id: "mp-path-casing",
    type: "line",
    source: "mp-paths",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#fff",
      "line-width": 6,
      "line-opacity": 0.5,
      "line-blur": 1,
    },
  },
  {
    id: "mp-path-pending",
    type: "line",
    source: "mp-paths",
    filter: [
      "in",
      ["get", "status"],
      ["literal", ["PENDING", "WAITING", "CANCELLED", "SKIPPED"]],
    ],
    paint: {
      "line-color": "#64748B",
      "line-width": 2.5,
      "line-dasharray": [3, 2],
    },
  },
  {
    id: "mp-path-finished",
    type: "line",
    source: "mp-paths",
    filter: ["==", ["get", "status"], "FINISHED"],
    paint: {
      "line-color": "#16A34A",
      "line-width": 3,
      "line-opacity": 0.6,
    },
  },
  {
    id: "mp-path-running",
    type: "line",
    source: "mp-paths",
    filter: [
      "in",
      ["get", "status"],
      ["literal", ["RUNNING", "INITIALIZING", "PAUSED"]],
    ],
    paint: { "line-color": "#16A34A", "line-width": 4 },
  },
  {
    id: "mp-path-failed",
    type: "line",
    source: "mp-paths",
    filter: ["==", ["get", "status"], "FAILED"],
    paint: { "line-color": "#EF4444", "line-width": 3 },
  },
  {
    id: "mp-waypoints",
    type: "circle",
    source: "mp-waypoints",
    paint: {
      "circle-radius": 4,
      "circle-color": STATUS_MATCH,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5,
    },
  },
  // Light origin, dark destination, as a route reads on any map. Tone rather than size tells them
  // apart, so the ends stay the scale of the waypoints they belong to. The destination forgoes the
  // status colour for that darkness, which the path and the dots either side of it still carry.
  {
    id: "mp-waypoint-endpoints",
    type: "circle",
    source: "mp-waypoints",
    filter: ["in", ["get", "role"], ["literal", ["start", "end"]]],
    paint: {
      "circle-radius": 5,
      "circle-color": [
        "case",
        ["==", ["get", "role"], "end"],
        ENDPOINT_DARK,
        "#fff",
      ],
      "circle-stroke-color": [
        "case",
        ["==", ["get", "role"], "end"],
        "#fff",
        STATUS_MATCH,
      ],
      "circle-stroke-width": ["case", ["==", ["get", "role"], "end"], 1.5, 2],
    },
  },
  // Hover target, wider than the mark it belongs to because a 5px dot is hard to point at.
  {
    id: "mp-endpoint-hit",
    type: "circle",
    source: "mp-waypoints",
    filter: ["in", ["get", "role"], ["literal", ["start", "end"]]],
    paint: {
      "circle-radius": 13,
      "circle-color": "#fff",
      "circle-opacity": 0.01,
    },
  },
  {
    id: "mp-robot-halo",
    type: "circle",
    source: "mp-robot",
    paint: {
      "circle-radius": 16,
      "circle-color": "#16A34A",
      "circle-opacity": 0.2,
    },
  },
  {
    id: "mp-robot-dot",
    type: "circle",
    source: "mp-robot",
    paint: {
      "circle-radius": 7,
      "circle-color": "#16A34A",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2.5,
    },
  },
];

/**
 * Build the endpoint label, one pill reused for whichever end the pointer is over.
 *
 * White is the only fill that holds against both the orthophoto and the street basemap. Shown on
 * hover alone, since the dots already mark the ends and a pinned label would cover the geometry.
 */
function createEndpointLabel(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    display: none; align-items: center; gap: 5px;
    padding: 2px 6px; border-radius: 4px; white-space: nowrap;
    background: #fff; border: 1px solid #E2E8F0;
    box-shadow: 0 1px 3px rgba(15,23,42,0.18);
    font: 600 10px/1 'DM Sans', sans-serif;
    letter-spacing: 0.06em; text-transform: uppercase; color: #475569;
    pointer-events: none;
  `;
  const dot = document.createElement("span");
  dot.style.cssText = "width: 6px; height: 6px; border-radius: 50%;";
  el.append(dot, document.createElement("span"));
  return el;
}

const SOURCES: Record<string, maplibregl.SourceSpecification> = {
  ...MAP_SOURCES,
  "mp-field": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  "mp-mainland": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  "mp-paths": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  "mp-waypoints": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  "mp-robot": {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
};

export function MissionPathPreview({
  stages,
  fitKey,
  state,
  sites,
  siteAnchors,
  fields = [],
  robotId = null,
}: MissionPathPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fittedRef = useRef(false);

  // The mainland comes with the stage rather than from the field, because the field can be
  // edited after a plan is made.
  const coverage = useMemo(
    () => stages.filter((s): s is CoverageStage => s.kind === "coverage"),
    [stages],
  );

  // Live robot pose from the fleet WS stream (null when no robot is given, the robot is
  // offline, or its first pose has not arrived yet).
  const robotPose = useFleet((s) =>
    robotId ? (s.robots[robotId]?.pose ?? null) : null,
  );

  const paths = useMemo(
    () => resolveStagePaths(stages, state?.stage_states, sites, siteAnchors),
    [stages, state, sites, siteAnchors],
  );

  // One-time map init.
  useEffect(() => {
    if (!containerRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: SOURCES,
        layers: [...baseLayers(loadBasemap()), ...FIELD_LAYERS, ...PATH_LAYERS],
      },
      center: [8.020798, 52.286366],
      zoom: 15,
      attributionControl: false,
    });
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // The route swaps the id without remounting, so the one-time fit has to be re-armed or the next
  // mission inherits the previous one's viewport.
  useEffect(() => {
    fittedRef.current = false;
  }, [fitKey]);

  // Data updates + initial fit-bounds.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    // False until the style has been parsed and the sources exist. Gating on that rather than on
    // the map reporting itself loaded, which also waits on every tile and so can stay false for as
    // long as the imagery is slow, leaving the geometry undrawn.
    const apply = () => {
      const fieldSource = m.getSource("mp-field") as
        | maplibregl.GeoJSONSource
        | undefined;
      const mainlandSource = m.getSource("mp-mainland") as
        | maplibregl.GeoJSONSource
        | undefined;
      const pathSource = m.getSource("mp-paths") as
        | maplibregl.GeoJSONSource
        | undefined;
      const pointSource = m.getSource("mp-waypoints") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!fieldSource || !mainlandSource || !pathSource || !pointSource) {
        return false;
      }

      const lineFeatures = paths
        .filter((p) => p.line.length >= 2)
        .map((p) => ({
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: p.line,
          },
          properties: { stageIndex: p.stageIndex, status: p.status },
        }));

      const ends = endpointKeys(paths);
      const pointFeatures = paths.flatMap((p) =>
        p.marks.map((c, wi) => {
          const key = `${p.stageIndex}:${wi}`;
          return {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: c },
            properties: {
              stageIndex: p.stageIndex,
              waypointIndex: wi,
              status: p.status,
              role:
                key === ends.start ? "start" : key === ends.end ? "end" : "mid",
            },
          };
        }),
      );

      fieldSource.setData(toFieldGeoJSON(fields));
      mainlandSource.setData(mainlandFeatures(coverage));
      pathSource.setData({ type: "FeatureCollection", features: lineFeatures });
      pointSource.setData({
        type: "FeatureCollection",
        features: pointFeatures,
      });

      // Fit bounds once after first data load, before any user interaction. The ceiling binds
      // only on fields small enough to fit inside it, and a field of a few hundred square metres
      // is one: capped at the last zoom OSM publishes, it lands as a stamp in the middle of the
      // view. Past that both basemaps scale up their z19 tiles, which is soft but legible.
      if (!fittedRef.current) {
        const b = boundsOf(paths, fields);
        if (b) {
          m.fitBounds(b, { padding: 30, duration: 0, maxZoom: 20 });
          fittedRef.current = true;
        }
      }
      return true;
    };

    if (apply()) return;
    // Retried rather than waited on `load`, which fires once per map: a mission opened after it
    // would wait on an event already past and keep the previous mission's geometry.
    const onStyleData = () => {
      if (apply()) m.off("styledata", onStyleData);
    };
    m.on("styledata", onStyleData);
    return () => {
      m.off("styledata", onStyleData);
    };
  }, [paths, fields, coverage]);

  // HTML rather than a symbol layer: the style carries no glyph source, so text would not draw.
  // Bound once, since the label belongs to the map rather than to any one data frame.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const el = createEndpointLabel();
    const marker = new maplibregl.Marker({
      element: el,
      anchor: "bottom",
      offset: [0, -10],
    })
      .setLngLat([0, 0])
      .addTo(m);

    const show = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const role = feature.properties?.role;
      if (role !== "start" && role !== "end") return;
      const dot = el.firstElementChild as HTMLElement;
      const text = el.lastElementChild as HTMLElement;
      dot.style.background =
        role === "end"
          ? ENDPOINT_DARK
          : statusColor(feature.properties?.status as StagePath["status"]);
      text.textContent = role === "start" ? "Start" : "End";
      marker.setLngLat(feature.geometry.coordinates as [number, number]);
      el.style.display = "flex";
    };
    const hide = () => {
      el.style.display = "none";
    };

    m.on("mousemove", "mp-endpoint-hit", show);
    m.on("mouseleave", "mp-endpoint-hit", hide);
    return () => {
      m.off("mousemove", "mp-endpoint-hit", show);
      m.off("mouseleave", "mp-endpoint-hit", hide);
      marker.remove();
    };
  }, []);

  // Robot position updates — high-frequency; cheap setData calls only.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const src = m.getSource("mp-robot") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (robotPose) {
      src.setData({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [robotPose.lon, robotPose.lat],
        },
        properties: {},
      });
    } else {
      src.setData({ type: "FeatureCollection", features: [] });
    }
  }, [robotPose]);

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden border border-border">
      <div ref={containerRef} className="absolute inset-0" />
      <BasemapControl mapRef={mapRef} />
    </div>
  );
}
