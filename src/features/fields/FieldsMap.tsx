import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "@tanstack/react-router";
import { useFields } from "@/api/fields";
import type { Field } from "@/api/client";
import { loadMapView, saveMapView, loadBasemap } from "@/stores/mapView";
import { BasemapControl } from "@/components/map/BasemapControl";
import {
  MAP_SOURCES,
  baseLayers,
} from "@/components/map/BasemapControl.constants";
import { fieldBbox, toFieldGeoJSON } from "@/components/map/fieldUtils";

type Props = { selectedFieldId: string | null };

export function FieldsMap({ selectedFieldId }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fieldsRef = useRef<Field[]>([]);
  const selectedFieldIdRef = useRef<string | null>(selectedFieldId);
  const prevSelectedRef = useRef<string | null>(null);
  const hasFitBoundsRef = useRef(false);
  const navigate = useNavigate();
  const { data: fields } = useFields();

  useEffect(() => {
    fieldsRef.current = fields ?? [];
  }, [fields]);

  useEffect(() => {
    selectedFieldIdRef.current = selectedFieldId;
  }, [selectedFieldId]);

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
            data: toFieldGeoJSON(fieldsRef.current),
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

    map.on("click", "fields-fill", (e) => {
      if (!e.features?.length) return;
      const id = e.features[0].properties?.id as string | undefined;
      if (id) navigate({ to: "/fields/$id", params: { id } });
    });
    map.on("mouseenter", "fields-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "fields-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    map.once("style.load", () => {
      const initId = selectedFieldIdRef.current;
      if (initId) {
        map.setFeatureState(
          { source: "fields", id: initId },
          { selected: true },
        );
        const field = fieldsRef.current.find((f) => f.id === initId);
        if (field) {
          map.fitBounds(fieldBbox(field.geometry), {
            padding: 80,
            maxZoom: 17,
            duration: 600,
          });
          hasFitBoundsRef.current = true;
        }
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [navigate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("fields") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(toFieldGeoJSON(fields ?? []));
    const id = selectedFieldIdRef.current;
    if (!id) return;
    map.setFeatureState({ source: "fields", id }, { selected: true });
    if (!hasFitBoundsRef.current) {
      const field = (fields ?? []).find((f) => f.id === id);
      if (field) {
        map.fitBounds(fieldBbox(field.geometry), {
          padding: 80,
          maxZoom: 17,
          duration: 600,
        });
        hasFitBoundsRef.current = true;
      }
    }
  }, [fields]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("fields");
    if (!map || !source) return;

    if (selectedFieldId !== prevSelectedRef.current) {
      if (prevSelectedRef.current)
        map.removeFeatureState(
          { source: "fields", id: prevSelectedRef.current },
          "selected",
        );
      prevSelectedRef.current = selectedFieldId;
    }

    if (!selectedFieldId) return;

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

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="absolute inset-0" />
      <BasemapControl mapRef={mapRef} />
    </div>
  );
}
