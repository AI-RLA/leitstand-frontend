import { createContext, useContext, useEffect, useEffectEvent } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import type { MapLayerMouseEvent, MapSourceDataEvent } from "maplibre-gl";

export interface MapInteraction {
  registerHoverLayer: (layerId: string) => () => void;
}

export const MapInteractionContext = createContext<MapInteraction | null>(null);

// The shell owns the cursor, so a layer only announces that hovering it should show a pointer.
export function useLayerInteraction(
  layerId: string,
  onClick?: (e: MapLayerMouseEvent) => void,
) {
  const map = useMap().current?.getMap();
  const interaction = useContext(MapInteractionContext);
  const clickable = onClick !== undefined;
  const handleClick = useEffectEvent((e: MapLayerMouseEvent) => onClick?.(e));

  useEffect(() => {
    if (!clickable || !interaction) return;
    return interaction.registerHoverLayer(layerId);
  }, [clickable, interaction, layerId]);

  useEffect(() => {
    if (!map || !clickable) return;
    const click = (e: MapLayerMouseEvent) => handleClick(e);
    map.on("click", layerId, click);
    return () => {
      map.off("click", layerId, click);
    };
  }, [map, clickable, layerId]);
}

// MapLibre keeps feature state for the life of a source, so it is set once the source exists.
export function useFeatureFlag(
  sourceId: string,
  featureId: string | null,
  flag: string,
) {
  const map = useMap().current?.getMap();

  useEffect(() => {
    if (!map || featureId === null) return;
    const target = { source: sourceId, id: featureId };
    const apply = () => map.setFeatureState(target, { [flag]: true });
    const onSourceData = (e: MapSourceDataEvent) => {
      if (e.sourceId !== sourceId || !map.getSource(sourceId)) return;
      map.off("sourcedata", onSourceData);
      apply();
    };
    if (map.getSource(sourceId)) apply();
    else map.on("sourcedata", onSourceData);
    return () => {
      map.off("sourcedata", onSourceData);
      if (map.getSource(sourceId)) map.removeFeatureState(target, flag);
    };
  }, [map, sourceId, featureId, flag]);
}
