import type { StyleSpecification } from "maplibre-gl";

export const BACKGROUND_COLOR = "#e2e8f0";

// A hidden layer that marks where the basemaps end, so they stay below page content whatever order
// react-maplibre adds layers in.
export const BASEMAPS_END = "basemaps-end";

// A changed style is applied as a diff that re-creates every app source, so the style never changes.
export const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    // Fills the areas outside a basemap's bounds, where MapLibre requests no tiles.
    {
      id: "background",
      type: "background",
      paint: { "background-color": BACKGROUND_COLOR },
    },
    { id: BASEMAPS_END, type: "background", layout: { visibility: "none" } },
  ],
};
