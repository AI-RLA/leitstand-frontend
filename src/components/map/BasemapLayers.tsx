import { memo } from "react";
import { Layer, Source } from "@vis.gl/react-maplibre";
import { useActiveBasemap } from "@/stores/mapLayers";
import { BASEMAPS_END } from "./baseStyle";

const VISIBLE = { visibility: "visible" } as const;
const HIDDEN = { visibility: "none" } as const;

const layerId = (entryId: string) => `basemap-${entryId}`;

// Switching only changes visibility, so the style, the app layers and their feature state stay unchanged.
export const BasemapLayers = memo(function BasemapLayers() {
  const { entries, active } = useActiveBasemap();
  return (
    <>
      {entries.map((e) => (
        <Source key={e.id} id={layerId(e.id)} {...e.source}>
          <Layer
            id={layerId(e.id)}
            type="raster"
            beforeId={BASEMAPS_END}
            layout={e.id === active?.id ? VISIBLE : HIDDEN}
          />
        </Source>
      ))}
    </>
  );
});
