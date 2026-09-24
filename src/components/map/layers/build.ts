import type {
  LayerSpecification,
  Map as MapLibreMap,
  RasterSourceSpecification,
} from "maplibre-gl";
import type { BasemapEntry } from "@/config/mapConfig";

// A colon keeps it apart from basemap-<id>, since config ids cannot contain one.
export const BACKGROUND_ID = "basemap:background";
export const BACKGROUND_PAINT = { "background-color": "#e2e8f0" } as const;

export function layerId(entryId: string): string {
  return `basemap-${entryId}`;
}

export function sourcesOf(
  entries: BasemapEntry[],
): Record<string, RasterSourceSpecification> {
  return Object.fromEntries(entries.map((e) => [layerId(e.id), e.source]));
}

// The background is the first layer because MapLibre requests nothing outside a source's bounds.
export function baseLayers(
  entries: BasemapEntry[],
  activeId: string | null,
): LayerSpecification[] {
  return [
    {
      id: BACKGROUND_ID,
      type: "background",
      paint: BACKGROUND_PAINT,
    },
    ...entries.map(
      (e): LayerSpecification => ({
        id: layerId(e.id),
        type: "raster",
        source: layerId(e.id),
        layout: { visibility: e.id === activeId ? "visible" : "none" },
      }),
    ),
  ];
}

export function showBasemap(
  map: MapLibreMap,
  entries: BasemapEntry[],
  activeId: string | null,
): void {
  for (const e of entries) {
    map.setLayoutProperty(
      layerId(e.id),
      "visibility",
      e.id === activeId ? "visible" : "none",
    );
  }
}
