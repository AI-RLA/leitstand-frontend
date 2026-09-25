import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import type { LngLatBoundsLike } from "maplibre-gl";

interface Props {
  bounds: LngLatBoundsLike | null;
  fitKey: unknown;
  padding?: number;
  maxZoom?: number;
  duration?: number;
}

// Fits once per fitKey, so new data for the same key does not move a map the operator has panned.
export function FitBounds({
  bounds,
  fitKey,
  padding = 80,
  maxZoom = 19,
  duration = 600,
}: Props) {
  const map = useMap().current;
  const fitted = useRef<unknown>(null);

  useEffect(() => {
    if (fitKey == null) {
      fitted.current = null;
      return;
    }
    if (!map || !bounds || fitted.current === fitKey) return;
    fitted.current = fitKey;
    map.fitBounds(bounds, { padding, maxZoom, duration });
  }, [map, bounds, fitKey, padding, maxZoom, duration]);

  return null;
}
