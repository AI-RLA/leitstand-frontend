import { Layer, Source } from "@vis.gl/react-maplibre";
import { useActiveBasemap } from "@/stores/mapLayers";
import { BACKGROUND_ID, BACKGROUND_PAINT, layerId } from "./layers/build";

const VISIBLE = { visibility: "visible" } as const;
const HIDDEN = { visibility: "none" } as const;

// Switching only changes visibility, so the style, the app layers and their feature state stay unchanged.
export function BasemapLayers() {
  const { entries, active } = useActiveBasemap();
  return (
    <>
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
}
