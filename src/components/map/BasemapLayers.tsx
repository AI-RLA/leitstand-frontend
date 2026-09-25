import { memo } from "react";
import { Layer, Source } from "@vis.gl/react-maplibre";
import { useActiveBasemap } from "@/stores/mapLayers";

export const BACKGROUND_COLOR = "#e2e8f0";

// A colon keeps it apart from basemap-<id>, since config ids cannot contain one.
const BACKGROUND_ID = "basemap:background";
const BACKGROUND_PAINT = { "background-color": BACKGROUND_COLOR } as const;
const VISIBLE = { visibility: "visible" } as const;
const HIDDEN = { visibility: "none" } as const;

const layerId = (entryId: string) => `basemap-${entryId}`;

// Switching only changes visibility, so the style, the app layers and their feature state stay unchanged.
export const BasemapLayers = memo(function BasemapLayers() {
  const { entries, active } = useActiveBasemap();
  return (
    <>
      {/* The background comes first because MapLibre requests nothing outside a source's bounds. */}
      <Layer id={BACKGROUND_ID} type="background" paint={BACKGROUND_PAINT} />
      {entries.map((e) => (
        <Source key={e.id} id={layerId(e.id)} {...e.source}>
          <Layer
            id={layerId(e.id)}
            type="raster"
            layout={e.id === active?.id ? VISIBLE : HIDDEN}
          />
        </Source>
      ))}
    </>
  );
});
