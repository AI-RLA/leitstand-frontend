import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadBasemap } from "@/stores/mapView";
import {
  MAP_SOURCES,
  baseLayers,
} from "@/components/map/BasemapControl.constants";
import { BasemapControl } from "@/components/map/BasemapControl";
import { useFleet } from "@/stores/fleet";
import { anchorFromSite, localToLatLon } from "../siteFrame";
import type { Mission, MissionState, Site, StageStateView } from "@/api/client";

interface MissionPathPreviewProps {
  mission: Mission;
  state: MissionState | null;
  sites: Site[];
}

interface StagePath {
  stageIndex: number;
  status: StageStateView["status"] | "PENDING";
  coords: [number, number][]; // [lng, lat]
}

function resolveStagePaths(
  stages: Mission["stages"],
  liveStates: StageStateView[] | undefined,
  sites: Site[],
): StagePath[] {
  // Join runtime by stage_id (the live frame's order need not match the definition).
  const byId = new Map<string, StageStateView>(
    (liveStates ?? []).map((s) => [s.stage_id, s]),
  );
  const out: StagePath[] = [];
  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    const coords: [number, number][] = [];
    for (const w of stage.waypoints) {
      if (w.kind === "wgs84") {
        if (Number.isFinite(w.lat) && Number.isFinite(w.lon)) {
          coords.push([w.lon, w.lat]);
        }
      } else if (w.kind === "site_local") {
        const site = sites.find((s) => s.site_id === w.site_id);
        if (site) {
          const ll = localToLatLon(anchorFromSite(site), w.x, w.y);
          coords.push([ll.lon, ll.lat]);
        }
      }
    }
    out.push({
      stageIndex: si,
      status: byId.get(stage.stage_id)?.status ?? "PENDING",
      coords,
    });
  }
  return out;
}

function boundsOf(paths: StagePath[]): maplibregl.LngLatBoundsLike | null {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let count = 0;
  for (const p of paths) {
    for (const [lon, lat] of p.coords) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      count++;
    }
  }
  if (count === 0) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

const PATH_LAYERS: maplibregl.LayerSpecification[] = [
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
      "line-color": "#94A3B8",
      "line-width": 2,
      "line-dasharray": [3, 2],
      "line-opacity": 0.85,
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
      "circle-color": [
        "match",
        ["get", "status"],
        "FINISHED",
        "#16A34A",
        "RUNNING",
        "#16A34A",
        "INITIALIZING",
        "#16A34A",
        "PAUSED",
        "#F59E0B",
        "FAILED",
        "#EF4444",
        "#94A3B8",
      ],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5,
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

const SOURCES: Record<string, maplibregl.SourceSpecification> = {
  ...MAP_SOURCES,
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
  mission,
  state,
  sites,
}: MissionPathPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fittedRef = useRef(false);

  // Live robot pose from the fleet WS stream (null when no robot assigned,
  // robot is offline, or first pose hasn't arrived yet).
  const robotId = mission.robot_id;
  const robotPose = useFleet((s) =>
    robotId ? (s.robots[robotId]?.pose ?? null) : null,
  );

  // One-time map init.
  useEffect(() => {
    if (!containerRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: SOURCES,
        layers: [...baseLayers(loadBasemap()), ...PATH_LAYERS],
      },
      center: [8.020798, 52.286366],
      zoom: 14,
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

  // Data updates + initial fit-bounds.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    const apply = () => {
      const paths = resolveStagePaths(
        mission.stages,
        state?.stage_states,
        sites,
      );

      const lineFeatures = paths
        .filter((p) => p.coords.length >= 2)
        .map((p) => ({
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: p.coords,
          },
          properties: { stageIndex: p.stageIndex, status: p.status },
        }));

      const pointFeatures = paths.flatMap((p) =>
        p.coords.map((c, wi) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: c },
          properties: {
            stageIndex: p.stageIndex,
            waypointIndex: wi,
            status: p.status,
          },
        })),
      );

      (
        m.getSource("mp-paths") as maplibregl.GeoJSONSource | undefined
      )?.setData({ type: "FeatureCollection", features: lineFeatures });
      (
        m.getSource("mp-waypoints") as maplibregl.GeoJSONSource | undefined
      )?.setData({ type: "FeatureCollection", features: pointFeatures });

      // Fit bounds once after first data load (before any user interaction).
      if (!fittedRef.current) {
        const b = boundsOf(paths);
        if (b) {
          m.fitBounds(b, { padding: 30, duration: 0, maxZoom: 18 });
          fittedRef.current = true;
        }
      }
    };

    if (m.loaded()) {
      apply();
    } else {
      m.once("load", apply);
      return () => {
        m.off("load", apply);
      };
    }
  }, [mission, state, sites]);

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
