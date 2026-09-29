import {
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  AttributionControl,
  GeolocateControl,
  Map,
  NavigationControl,
  useMap,
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
import { BACKGROUND_COLOR, BasemapLayers } from "./BasemapLayers";
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
  /** Where the map looks, usually the page's own content. Without it the map opens where resolveOpeningView finds something to show. */
  view?: OpeningView;
  /** The map moves to view again whenever this key changes, never for new data under the same key, and null waits for the next key. */
  viewKey?: string | null;
  /** How long a move to a new viewKey takes, 0 to jump. */
  viewDuration?: number;
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
  background: BACKGROUND_COLOR,
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
  const [opening, setOpening] = useState<{
    view: OpeningView;
    key: string | null | undefined;
  } | null>(null);
  const ready = props.ready ?? true;
  // The lists matter only until the view is decided, and not at all when a view is already known.
  const lists = {
    enabled: opening === null && ready && !props.view && !saved,
    subscribed: opening === null,
  };
  const robots = useRobots(lists);
  const fields = useFields(lists);
  const sites = useSites(lists);

  if (opening === null) {
    if (ready && props.view) {
      setOpening({ view: props.view, key: props.viewKey });
    } else if (ready) {
      const resolved = resolveOpeningView({
        saved,
        robots: settled(robots),
        fields: settled(fields),
        sites: settled(sites),
        home,
      });
      if (resolved) setOpening({ view: resolved, key: undefined });
    }
    return <div style={LOADING_STYLE} />;
  }
  return (
    <MapCanvas {...props} opening={opening.view} openedKey={opening.key} />
  );
}

/** Choose the map cursor from the active tool, the page, or the hover over a clickable layer. */
function mapCursor(
  claimed: string | undefined,
  page: string | undefined,
  hovering: boolean,
): string {
  // An empty cursor leaves the choice to MapLibre, which shows its grab hand for panning.
  return claimed ?? page ?? (hovering ? "pointer" : "");
}

// Fits once per key, so an operator who has panned keeps the view until the page shows something else.
function FollowView({
  view,
  viewKey,
  openedKey,
  duration,
}: {
  view: OpeningView | undefined;
  viewKey: string | null | undefined;
  openedKey: string | null | undefined;
  duration: number;
}) {
  const map = useMap().current;
  const applied = useRef<string | null | undefined>(openedKey);

  useEffect(() => {
    if (viewKey == null) {
      applied.current = null;
      return;
    }
    if (!map || !view || applied.current === viewKey) return;
    applied.current = viewKey;
    if ("bounds" in view) {
      map.fitBounds(view.bounds, {
        padding: view.padding ?? OPENING_FIT.padding,
        maxZoom: view.maxZoom ?? OPENING_FIT.maxZoom,
        duration,
      });
    } else {
      // North up, as a box fit also turns the map, so both kinds of view look the same.
      map.easeTo({
        center: view.center,
        zoom: view.zoom,
        bearing: 0,
        duration,
      });
    }
  }, [map, view, viewKey, duration]);

  return null;
}

function MapCanvas({
  opening,
  openedKey,
  view,
  viewKey,
  viewDuration = 600,
  rememberView = false,
  children,
  navigation = {},
  onClick,
  cursor,
  ref,
}: Props & { opening: OpeningView; openedKey: string | null | undefined }) {
  const [noWebGL2, setNoWebGL2] = useState(false);
  const [hoverLayers, setHoverLayers] = useState<string[]>([]);
  const [hovering, setHovering] = useState(false);
  const [claimed, setClaimed] = useState<{ cursor: string } | null>(null);

  const registerHoverLayer = useCallback((layerId: string) => {
    setHoverLayers((ids) => [...ids, layerId]);
    return () =>
      setHoverLayers((ids) => {
        const i = ids.indexOf(layerId);
        return i < 0 ? ids : [...ids.slice(0, i), ...ids.slice(i + 1)];
      });
  }, []);
  const claimCursor = useCallback((cursor: string) => {
    const claim = { cursor };
    setClaimed(claim);
    // Clears only its own claim, so a late release never takes the cursor from a newer one.
    return () => setClaimed((current) => (current === claim ? null : current));
  }, []);
  const interaction = useMemo<MapInteraction>(
    () => ({ registerHoverLayer, claimCursor }),
    [registerHoverLayer, claimCursor],
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
        interactiveLayerIds={hoverLayers.length > 0 ? hoverLayers : undefined}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        cursor={mapCursor(claimed?.cursor, cursor, hovering)}
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
        <FollowView
          view={view}
          viewKey={viewKey}
          openedKey={openedKey}
          duration={viewDuration}
        />
        {navigation && (
          <NavigationControl position="bottom-right" {...navigation} />
        )}
        {/* Browsers give a position only on HTTPS or localhost, so elsewhere the button could never work. */}
        {/* In development React adds, removes and re-adds controls, and MapLibre's GeolocateControl then answers each click twice, so the button only seems dead under npm run dev. */}
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
