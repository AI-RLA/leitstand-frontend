import { Component, type ReactNode } from "react";
import { GPUInitializationError } from "maplibre-gl";
import { MapUnavailable } from "./MapUnavailable";

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

// MapLibre throws GPUInitializationError from the map constructor when the browser has no WebGL2.
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error instanceof GPUInitializationError) {
      return <MapUnavailable />;
    }
    // Any other error goes on to the route's error component, as it did without this boundary.
    if (error) throw error;
    return this.props.children;
  }
}
