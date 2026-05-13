import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useFleet } from "@/stores/fleet";
import { useFields } from "@/api/fields";
import type { Field } from "@/api/client";
import { MARKER_COLOR } from "./constants";
import { loadMapView, saveMapView, loadBasemap } from "@/stores/mapView";
import { BasemapControl } from "@/components/map/BasemapControl";
import {
  MAP_SOURCES,
  baseLayers,
} from "@/components/map/BasemapControl.constants";
import { fieldBbox, toFieldGeoJSON } from "@/components/map/fieldUtils";

function buildFieldPopupEl(field: Field): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText =
    "font-family:'DM Sans',sans-serif;padding:10px 12px;min-width:160px;max-width:210px;" +
    "border-top:3px solid #16A34A;";

  const nameRow = document.createElement("div");
  nameRow.style.cssText =
    "display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px;";
  const name = document.createElement("span");
  name.style.cssText = "font-size:13px;font-weight:700;color:#0F172A;";
  name.textContent = field.name;
  const typeLabel = document.createElement("span");
  typeLabel.style.cssText =
    "font-size:9px;font-weight:600;letter-spacing:0.06em;color:#94A3B8;" +
    "text-transform:uppercase;flex-shrink:0;";
  typeLabel.textContent = "field";
  nameRow.appendChild(name);
  nameRow.appendChild(typeLabel);
  root.appendChild(nameRow);

  const area = document.createElement("div");
  area.style.cssText =
    "font-size:18px;font-weight:700;color:#15803D;line-height:1;margin-bottom:2px;";
  area.textContent = field.area_ha.toFixed(2);
  const areaUnit = document.createElement("span");
  areaUnit.style.cssText =
    "font-size:11px;font-weight:500;color:#64748B;margin-left:3px;";
  areaUnit.textContent = "ha";
  area.appendChild(areaUnit);
  root.appendChild(area);

  if (field.notes) {
    const notes = document.createElement("div");
    notes.style.cssText =
      "font-size:10px;color:#94A3B8;margin-top:6px;line-height:1.4;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    notes.textContent = field.notes;
    root.appendChild(notes);
  }

  return root;
}

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
// change via the Zustand subscription set up in the map effect.
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
      ? (MARKER_COLOR[r.state?.status ?? "idle"] ?? "#94A3B8")
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
  // Outer div is 0×0 so MapLibre's anchor math is trivial; inner div centers
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

export function FleetMap() {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Record<string, maplibregl.Marker>>({});
  const circleRef = useRef<CircleHandle | null>(null);
  const fieldPopupRef = useRef<maplibregl.Popup | null>(null);
  const fieldsRef = useRef<Field[]>([]);
  const prevSelectedFieldIdRef = useRef<string | null>(null);

  const selectedFieldId = useFleet((s) => s.selectedFieldId);
  const { data: fields } = useFields();

  // Keep fieldsRef current so map click handlers never see stale data
  useEffect(() => {
    fieldsRef.current = fields ?? [];
  }, [fields]);

  useEffect(() => {
    if (!ref.current) return;
    const fieldLayers: maplibregl.LayerSpecification[] = [
      {
        id: "fields-fill",
        type: "fill",
        source: "fields",
        paint: {
          "fill-color": "#16A34A",
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.22,
            0.1,
          ],
        },
      },
      {
        id: "fields-outline",
        type: "line",
        source: "fields",
        paint: {
          "line-color": "#16A34A",
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2.5,
            1.5,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            1,
            0.6,
          ],
        },
      },
    ];
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          ...MAP_SOURCES,
          fields: {
            type: "geojson",
            data: toFieldGeoJSON(
              fieldsRef.current,
            ) as unknown as GeoJSON.FeatureCollection,
            promoteId: "id",
          },
        },
        layers: [...baseLayers(loadBasemap()), ...fieldLayers],
      },
      ...loadMapView(),
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    map.on("moveend", () => {
      const c = map.getCenter();
      saveMapView([c.lng, c.lat], map.getZoom());
    });

    const fieldPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      offset: 4,
      maxWidth: "220px",
    });
    fieldPopup.on("close", () => useFleet.getState().selectField(null));
    fieldPopupRef.current = fieldPopup;

    map.on("click", "fields-fill", (e) => {
      if (!e.features?.length) return;
      const id = e.features[0].properties?.id as string | undefined;
      if (!id) return;
      const field = fieldsRef.current.find((f) => f.id === id);
      if (!field) return;
      const { selectField: sf, selectedFieldId: cur } = useFleet.getState();
      if (cur === id) {
        sf(null);
        fieldPopup.remove();
      } else {
        sf(id);
        fieldPopup
          .setLngLat(e.lngLat)
          .setDOMContent(buildFieldPopupEl(field))
          .addTo(map);
      }
    });
    map.on("mouseenter", "fields-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "fields-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;

    // Sync markers immediately with whatever is already in the store (handles
    // page refresh where robots are seeded before the map is created), then
    // keep in sync via subscription for the lifetime of this map instance.
    syncMarkers(map, markers.current, circleRef);
    const unsubMarkers = useFleet.subscribe(() =>
      syncMarkers(map, markers.current, circleRef),
    );

    return () => {
      unsubMarkers();
      if (circleRef.current) {
        map.off("zoom", circleRef.current.resizeFn);
        circleRef.current = null;
      }
      fieldPopup.remove();
      fieldPopupRef.current = null;
      map.remove();
      mapRef.current = null;
      markers.current = {};
    };
  }, []);

  // Push fresh field polygons into the GeoJSON source on every data change.
  // setData() clears all feature states, so re-apply the current selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("fields") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(
      toFieldGeoJSON(fields ?? []) as unknown as GeoJSON.FeatureCollection,
    );
    const id = useFleet.getState().selectedFieldId;
    if (id) map.setFeatureState({ source: "fields", id }, { selected: true });
  }, [fields]);

  // Update field highlight and fit bounds when field selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("fields")) return;

    if (selectedFieldId !== prevSelectedFieldIdRef.current) {
      if (prevSelectedFieldIdRef.current)
        map.removeFeatureState(
          { source: "fields", id: prevSelectedFieldIdRef.current },
          "selected",
        );
      prevSelectedFieldIdRef.current = selectedFieldId;
    }

    if (!selectedFieldId) {
      return;
    }

    map.setFeatureState(
      { source: "fields", id: selectedFieldId },
      { selected: true },
    );

    const field = fieldsRef.current.find((f) => f.id === selectedFieldId);
    if (field) {
      map.fitBounds(fieldBbox(field.geometry), {
        padding: 80,
        maxZoom: 17,
        duration: 600,
      });
    }
  }, [selectedFieldId]);

  const flyToRequest = useFleet((s) => s.flyToRequest);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToRequest) return;
    const robot = useFleet.getState().robots[flyToRequest.robotId];
    if (!robot?.pose) return;
    map.flyTo({ center: [robot.pose.lon, robot.pose.lat], speed: 1.5 });
  }, [flyToRequest]);

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="absolute inset-0" />
      <BasemapControl mapRef={mapRef} />
    </div>
  );
}
