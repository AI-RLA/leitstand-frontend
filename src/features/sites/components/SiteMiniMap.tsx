import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { headingEndpoint } from "@/lib/geo";
import {
  mapSources,
  baseLayers,
} from "@/components/map/BasemapControl.constants";
import { LayerControl } from "@/components/map/LayerControl";
import type { SiteViewModel } from "../adapters";

interface SiteMiniMapProps {
  vm: SiteViewModel;
}

export function SiteMiniMap({ vm }: SiteMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loadedMap, setLoadedMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const endpoint = headingEndpoint(
      vm.anchorLat,
      vm.anchorLon,
      vm.anchorHeadingDeg,
      12,
    );

    const sources: Record<string, maplibregl.SourceSpecification> = {
      ...mapSources(),
      "site-anchor": {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [vm.anchorLon, vm.anchorLat],
          },
          properties: {},
        },
      },
      "site-heading": {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [[vm.anchorLon, vm.anchorLat], endpoint],
          },
          properties: {},
        },
      },
      "site-outline": {
        type: "geojson",
        data: vm.outline
          ? {
              type: "Feature",
              // Backend Polygon allows bbox: null which GeoJSON.Polygon does
              // not — drop it; bbox is optional and we don't need it here.
              geometry: {
                type: "Polygon",
                coordinates: vm.outline.coordinates,
              },
              properties: {},
            }
          : { type: "FeatureCollection", features: [] },
      },
    };

    const layers: maplibregl.LayerSpecification[] = [
      ...baseLayers(),
      {
        id: "site-outline-fill",
        type: "fill",
        source: "site-outline",
        paint: { "fill-color": "#16A34A", "fill-opacity": 0.15 },
      },
      {
        id: "site-outline-line",
        type: "line",
        source: "site-outline",
        paint: { "line-color": "#16A34A", "line-width": 2 },
      },
      {
        id: "site-heading-line",
        type: "line",
        source: "site-heading",
        paint: { "line-color": "#16A34A", "line-width": 3 },
      },
      {
        id: "site-anchor-dot",
        type: "circle",
        source: "site-anchor",
        paint: {
          "circle-radius": 7,
          "circle-color": "#16A34A",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      },
    ];

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: { version: 8, sources, layers },
      center: [vm.anchorLon, vm.anchorLat],
      zoom: 17,
    });
    m.once("style.load", () => setLoadedMap(m));
    mapRef.current = m;

    return () => {
      m.remove();
      mapRef.current = null;
      setLoadedMap(null);
    };
  }, [vm.id, vm.anchorLat, vm.anchorLon, vm.anchorHeadingDeg, vm.outline]);

  return (
    <div className="relative h-[320px] rounded-lg overflow-hidden border border-border mb-3">
      <div ref={containerRef} className="absolute inset-0" />
      <LayerControl map={loadedMap} />
    </div>
  );
}
