import { useEffect, useState } from "react";
import type { RefObject } from "react";
import maplibregl from "maplibre-gl";
import { loadBasemap, saveBasemap } from "@/stores/mapView";

interface Props {
  mapRef: RefObject<maplibregl.Map | null>;
}

export function BasemapControl({ mapRef }: Props) {
  const [basemap, setBasemap] = useState<"osm" | "dop">(loadBasemap);
  const [layerOpen, setLayerOpen] = useState(false);

  useEffect(() => {
    saveBasemap(basemap);
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      map.setLayoutProperty(
        "osm",
        "visibility",
        basemap === "osm" ? "visible" : "none",
      );
      map.setLayoutProperty(
        "dop",
        "visibility",
        basemap === "dop" ? "visible" : "none",
      );
    };
    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    map.once("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [basemap]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {layerOpen && (
        <div
          className="absolute inset-0 z-10"
          onClick={() => setLayerOpen(false)}
        />
      )}
      <div className="absolute top-2 right-2 z-20">
        <button
          onClick={() => setLayerOpen((o) => !o)}
          title="Layers"
          className="flex h-[29px] w-[29px] items-center justify-center rounded border border-slate-300 bg-white shadow-md transition-colors hover:bg-slate-50"
        >
          <svg
            viewBox="0 0 18 18"
            width="15"
            height="15"
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 1.5L1 5.5l8 4 8-4-8-4z" />
            <path d="M1 9.5l8 4 8-4" />
            <path d="M1 13.5l8 4 8-4" />
          </svg>
        </button>
        {layerOpen && (
          <div className="absolute right-0 top-8 min-w-[168px] rounded-lg border border-slate-100 bg-white py-1 shadow-xl">
            <div className="px-3 pb-1 pt-1.5 text-ui-xs font-semibold uppercase tracking-wider text-slate-400">
              Basemap
            </div>
            {(["osm", "dop"] as const).map((id) => (
              <button
                key={id}
                onClick={() => {
                  setBasemap(id);
                  setLayerOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-slate-50"
              >
                <span
                  className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border ${basemap === id ? "border-primary bg-primary" : "border-slate-300"}`}
                >
                  {basemap === id && (
                    <svg viewBox="0 0 8 8" width="6" height="6" fill="none">
                      <path
                        d="M1.5 4l2 2 3-3.5"
                        stroke="white"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={`text-ui-sm font-medium ${basemap === id ? "text-primary" : "text-slate-700"}`}
                >
                  {id === "osm" ? "OpenStreetMap" : "LGLN DOP20"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
