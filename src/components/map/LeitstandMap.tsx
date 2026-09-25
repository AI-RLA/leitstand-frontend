import {
  Suspense,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  AttributionControl,
  GeolocateControl,
  Map,
  NavigationControl,
  type ErrorEvent,
  type MapLayerMouseEvent,
  type MapRef,
} from "@vis.gl/react-maplibre";
import { GPUInitializationError, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadMapView, saveMapView } from "@/stores/mapView";
import { useFields } from "@/api/fields";
import { useRobots } from "@/api/robots";
import { useSites } from "@/api/sites";
import { mapConfigReady } from "@/config/mapConfig";
import { BasemapLayers } from "./BasemapLayers";
import { BACKGROUND_PAINT } from "./layers/build";
import { LayerControl } from "./LayerControl";
import { MapInteractionContext, type MapInteraction } from "./mapInteraction";
import { MapUnavailable } from "./MapUnavailable";
import { resolveOpeningView, type OpeningView } from "./openingView";

// A changed style is applied as a diff that re-creates every app source, so the style never changes.
const EMPTY_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] };

// MapLibre's own default control credits it, and passing any options to the control drops that link.
const MAPLIBRE_CREDIT =
  '<a href="https://maplibre.org/" target="_blank">MapLibre</a>';

interface Props {
  /** The opening view, usually the page's own content. Without it the map opens where resolveOpeningView finds something to show. */
  view?: OpeningView;
  /** False while the page's content is still loading, so the map opens on it rather than moving there after. */
  ready?: boolean;
  /** Saves the view after every move, so the next map without a fixed view opens there. */
  rememberView?: boolean;
  children?: ReactNode;
  navigation?: false | { showCompass?: boolean };
  onClick?: (e: MapLayerMouseEvent) => void;
  cursor?: string;
  ref?: Ref<MapRef>;
}

// Past this zoom a single robot or the operator's own position leaves too little around it to orient by.
const LOCATE_FIT = { maxZoom: 17 } as const;
const OPENING_FIT = { ...LOCATE_FIT, padding: 40 } as const;
// An operator on the field needs the GPS fix of a tablet, which takes longer than a network guess.
const LOCATE_POSITION = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10_000,
} as const;

const LOADING_STYLE = {
  position: "absolute",
  inset: 0,
  background: BACKGROUND_PAINT["background-color"],
} as const;

export function LeitstandMap(props: Props) {
  return (
    <Suspense fallback={<div style={LOADING_STYLE} />}>
      <MapInner {...props} />
    </Suspense>
  );
}

// A list that failed or waits for the network counts as empty, so the map still opens without them.
function settled<T>(query: {
  isPending: boolean;
  fetchStatus: string;
  data?: T[];
}): T[] | undefined {
  return query.isPending && query.fetchStatus !== "paused"
    ? undefined
    : (query.data ?? []);
}

// The center stands in for the box when the map is created too small to fit the box into.
function initialView(opening: OpeningView) {
  if (!("bounds" in opening)) {
    return {
      longitude: opening.center[0],
      latitude: opening.center[1],
      zoom: opening.zoom,
    };
  }
  const [[west, south], [east, north]] = opening.bounds;
  const maxZoom = opening.maxZoom ?? OPENING_FIT.maxZoom;
  return {
    bounds: opening.bounds,
    fitBoundsOptions: {
      padding: opening.padding ?? OPENING_FIT.padding,
      maxZoom,
    },
    longitude: (west + east) / 2,
    latitude: (south + north) / 2,
    zoom: maxZoom,
  };
}

function MapInner(props: Props) {
  // Waits for the basemap list before the map exists, so its layers never mount without it.
  const { home } = use(mapConfigReady);
  const [saved] = useState(loadMapView);
  // The map takes its opening view only at creation, so it is decided once and the lists stop here.
  const [opening, setOpening] = useState<OpeningView | null>(null);
  const ready = props.ready ?? true;
  const resolving = opening === null && ready && !props.view;
  const robots = useRobots({ enabled: resolving });
  const fields = useFields({ enabled: resolving });
  const sites = useSites({ enabled: resolving });

  if (opening === null) {
    const decided =
      ready &&
      (props.view ??
        resolveOpeningView({
          saved,
          robots: settled(robots),
          fields: settled(fields),
          sites: settled(sites),
          home,
        }));
    if (decided) setOpening(decided);
    return <div style={LOADING_STYLE} />;
  }
  return <MapCanvas {...props} opening={opening} />;
}

function MapCanvas({
  opening,
  rememberView = false,
  children,
  navigation = {},
  onClick,
  cursor,
  ref,
}: Props & { opening: OpeningView }) {
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
        initialViewState={initialView(opening)}
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
          rememberView
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
        {/* Browsers give a position only on HTTPS or localhost, so elsewhere the button could never work. */}
        {window.isSecureContext && (
          <GeolocateControl
            position="bottom-right"
            trackUserLocation
            positionOptions={LOCATE_POSITION}
            fitBoundsOptions={LOCATE_FIT}
          />
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
