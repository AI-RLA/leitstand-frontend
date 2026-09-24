import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  AttributionControl,
  Map,
  NavigationControl,
  type ErrorEvent,
  type MapLayerMouseEvent,
  type MapRef,
} from "@vis.gl/react-maplibre";
import { GPUInitializationError, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadMapView, saveMapView, type SavedMapView } from "@/stores/mapView";
import { BasemapLayers } from "./BasemapLayers";
import { LayerControl } from "./LayerControl";
import { MapInteractionContext, type MapInteraction } from "./mapInteraction";
import { MapUnavailable } from "./MapUnavailable";

export type MapView = "remembered" | SavedMapView;

// A changed style is applied as a diff that re-creates every app source, so the style never changes.
const EMPTY_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] };

// MapLibre's own default control credits it, and passing any options to the control drops that link.
const MAPLIBRE_CREDIT =
  '<a href="https://maplibre.org/" target="_blank">MapLibre</a>';

interface Props {
  view: MapView;
  children?: ReactNode;
  navigation?: false | { showCompass?: boolean };
  onClick?: (e: MapLayerMouseEvent) => void;
  cursor?: string;
  ref?: Ref<MapRef>;
}

export function LeitstandMap({
  view,
  children,
  navigation = {},
  onClick,
  cursor,
  ref,
}: Props) {
  const [initial] = useState(() =>
    view === "remembered" ? loadMapView() : view,
  );
  const [noWebGL2, setNoWebGL2] = useState(false);
  const [hoverLayers, setHoverLayers] = useState<string[]>([]);
  const [hovering, setHovering] = useState(false);

  const registerHoverLayer = useCallback((layerId: string) => {
    setHoverLayers((ids) => [...ids, layerId]);
    return () =>
      setHoverLayers((ids) => {
        const i = ids.indexOf(layerId);
        return i < 0 ? ids : [...ids.slice(0, i), ...ids.slice(i + 1)];
      });
  }, []);
  const interaction = useMemo<MapInteraction>(
    () => ({ registerHoverLayer }),
    [registerHoverLayer],
  );

  // The map is created inside a promise, so a missing WebGL2 arrives here and never reaches an error boundary.
  function handleError(e: ErrorEvent) {
    if (e.error instanceof GPUInitializationError) setNoWebGL2(true);
    else console.error(e.error);
  }

  if (noWebGL2) return <MapUnavailable />;

  return (
    <MapInteractionContext value={interaction}>
      <Map
        ref={ref}
        initialViewState={{
          longitude: initial.center[0],
          latitude: initial.center[1],
          zoom: initial.zoom,
        }}
        mapStyle={EMPTY_STYLE}
        attributionControl={false}
        // The host element must be positioned and have a height, as every page's map container does.
        style={{ position: "absolute", inset: 0 }}
        onError={handleError}
        onClick={onClick}
        interactiveLayerIds={hoverLayers}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        cursor={cursor ?? (hovering ? "pointer" : "")}
        onMoveEnd={
          view === "remembered"
            ? (e) => {
                const c = e.target.getCenter();
                saveMapView([c.lng, c.lat], e.target.getZoom());
              }
            : undefined
        }
      >
        <BasemapLayers />
        {children}
        {navigation && (
          <NavigationControl position="bottom-right" {...navigation} />
        )}
        {/* The OSM tile usage policy asks that the credit is never hidden behind a toggle, so it never collapses. */}
        <AttributionControl
          position="bottom-left"
          compact={false}
          customAttribution={MAPLIBRE_CREDIT}
        />
        <LayerControl />
      </Map>
    </MapInteractionContext>
  );
}
