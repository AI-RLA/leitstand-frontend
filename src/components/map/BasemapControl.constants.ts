import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import { getMapConfig } from "@/config/mapConfig";
import { baseLayers as buildBaseLayers, sourcesOf } from "./layers/build";
import { resolveBasemap, useMapLayers } from "@/stores/mapLayers";

export function mapSources(): Record<string, SourceSpecification> {
  return sourcesOf(getMapConfig().entries);
}

export function baseLayers(): LayerSpecification[] {
  const { entries } = getMapConfig();
  const active = resolveBasemap(useMapLayers.getState().basemap, entries);
  return buildBaseLayers(entries, active?.id ?? null);
}
