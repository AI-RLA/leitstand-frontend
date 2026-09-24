import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import { useMap } from "@vis.gl/react-maplibre";
import { useFleet } from "@/stores/fleet";
import { MARKER_COLOR } from "./constants";

type CircleHandle = {
  marker: maplibregl.Marker;
  innerEl: HTMLDivElement;
  resizeFn: () => void;
  robotId: string;
  lat: number;
  lon: number;
  radiusM: number;
};

// Imperative marker sync — reads directly from the store, no React render cycle.
// Called once on map init (handles robots already in store) and on every store
// change via the Zustand subscription set up in FleetRobotMarkers.
function syncMarkers(
  map: maplibregl.Map,
  markersRecord: Record<string, maplibregl.Marker>,
  circle: { current: CircleHandle | null },
): void {
  const { robots, selectedId } = useFleet.getState();
  const seen = new Set<string>();

  for (const r of Object.values(robots)) {
    if (!r.pose) continue;
    seen.add(r.id);
    const color = r.online
      ? (MARKER_COLOR[r.status ?? "idle"] ?? "#94A3B8")
      : MARKER_COLOR.offline;

    let m = markersRecord[r.id];
    if (!m) {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.85);
        box-shadow: 0 2px 8px rgba(0,0,0,0.35); cursor: pointer;
        font: 700 7px/1 'DM Sans', sans-serif; color: white;
        display: flex; align-items: center; justify-content: center;
      `;
      el.textContent = r.id.slice(-2);
      el.title = r.id;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const { selectedId: cur, select: sel } = useFleet.getState();
        sel(cur === r.id ? null : r.id);
      });
      m = new maplibregl.Marker({ element: el })
        .setLngLat([r.pose.lon, r.pose.lat])
        .addTo(map);
      markersRecord[r.id] = m;
    } else if (r.online) {
      m.setLngLat([r.pose.lon, r.pose.lat]);
    }

    const el = m.getElement();
    el.style.background = color;
    el.style.opacity = r.online ? "1" : "0.6";
    // Selection ring via box-shadow — MapLibre owns el.style.transform
    // (it's the marker's translate), so we must not touch it.
    el.style.boxShadow =
      r.online && selectedId === r.id
        ? "0 0 0 3px rgba(22,163,74,0.35), 0 2px 8px rgba(0,0,0,0.4)"
        : "0 2px 8px rgba(0,0,0,0.35)";
  }

  for (const id of Object.keys(markersRecord)) {
    if (!seen.has(id)) {
      markersRecord[id].remove();
      delete markersRecord[id];
    }
  }

  // Accuracy circle — rendered as a Marker so it updates in the same frame as
  // the robot dot (setLngLat is a synchronous CSS transform, no GeoJSON pipeline).
  // Outer div is 0×0 so MapLibre's anchor math is trivial. The inner div centers
  // itself with its own translate(-50%,-50%), independent of MapLibre's transform.
  const selected = selectedId ? robots[selectedId] : null;
  const pose = selected?.pose;
  const radiusM = pose?.horizontal_accuracy_m;
  const hasAccuracy =
    pose && typeof radiusM === "number" && Number.isFinite(radiusM);

  if (!hasAccuracy || !pose) {
    if (circle.current) {
      map.off("zoom", circle.current.resizeFn);
      circle.current.marker.remove();
      circle.current = null;
    }
    return;
  }

  const { lat, lon } = pose;
  const radius = radiusM as number;

  if (circle.current?.robotId === selectedId) {
    circle.current.lat = lat;
    circle.current.lon = lon;
    circle.current.radiusM = radius;
    circle.current.marker.setLngLat([lon, lat]);
    circle.current.resizeFn();
  } else {
    if (circle.current) {
      map.off("zoom", circle.current.resizeFn);
      circle.current.marker.remove();
    }

    const outerEl = document.createElement("div");
    outerEl.style.cssText = "width:0;height:0;";

    const innerEl = document.createElement("div");
    innerEl.style.cssText =
      "position:absolute;transform:translate(-50%,-50%);" +
      "border-radius:50%;pointer-events:none;" +
      "border:1px solid rgba(59,130,246,0.5);" +
      "background:rgba(59,130,246,0.12);";
    outerEl.appendChild(innerEl);

    const handle: CircleHandle = {
      marker: null!,
      innerEl,
      resizeFn: null!,
      robotId: selectedId!,
      lat,
      lon,
      radiusM: radius,
    };

    handle.resizeFn = () => {
      const c = map.project([handle.lon, handle.lat]);
      const e = map.project([
        handle.lon,
        handle.lat + handle.radiusM / 111_320,
      ]);
      const px = Math.hypot(e.x - c.x, e.y - c.y);
      handle.innerEl.style.width = `${px * 2}px`;
      handle.innerEl.style.height = `${px * 2}px`;
    };

    handle.marker = new maplibregl.Marker({ element: outerEl })
      .setLngLat([lon, lat])
      .addTo(map);

    map.on("zoom", handle.resizeFn);
    handle.resizeFn();

    circle.current = handle;
  }
}

// DOM markers updated outside React on every store change, until one robot layer component replaces them.
export function FleetRobotMarkers() {
  const map = useMap().current?.getMap();

  useEffect(() => {
    if (!map) return;
    const markers: Record<string, maplibregl.Marker> = {};
    const circle: { current: CircleHandle | null } = { current: null };
    syncMarkers(map, markers, circle);
    const unsubscribe = useFleet.subscribe(() =>
      syncMarkers(map, markers, circle),
    );
    return () => {
      unsubscribe();
      for (const marker of Object.values(markers)) marker.remove();
      if (circle.current) {
        map.off("zoom", circle.current.resizeFn);
        circle.current.marker.remove();
      }
    };
  }, [map]);

  return null;
}
