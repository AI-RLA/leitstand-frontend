import { useCallback, useState, useSyncExternalStore } from "react";
import * as maplibregl from "maplibre-gl";
import { useMap } from "@vis.gl/react-maplibre";
import { Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BasemapEntry } from "@/config/mapConfig";
import { useActiveBasemap, useMapLayers } from "@/stores/mapLayers";

function tooltip(e: BasemapEntry): string {
  const coverage = e.source.bounds ? "regional" : "worldwide";
  return [e.label, e.details, coverage].filter(Boolean).join(" · ");
}

// A string snapshot, so a move re-renders only when an entry gains or loses coverage.
function coveredIds(map: maplibregl.Map | null, entries: BasemapEntry[]) {
  if (!map) return "";
  const center = map.getCenter();
  return entries
    .filter(
      (e) =>
        !e.source.bounds ||
        new maplibregl.LngLatBounds(e.source.bounds).contains(center),
    )
    .map((e) => e.id)
    .join(" ");
}

export function LayerControl() {
  const map = useMap().current?.getMap() ?? null;
  const { entries, rejected, active } = useActiveBasemap();
  const selectBasemap = useMapLayers((s) => s.selectBasemap);
  const activeId = active?.id ?? null;
  const [open, setOpen] = useState(false);

  const subscribe = useCallback(
    (onChange: () => void) => {
      map?.on("moveend", onChange);
      return () => {
        map?.off("moveend", onChange);
      };
    },
    [map],
  );
  const covered = useSyncExternalStore(subscribe, () =>
    coveredIds(map, entries),
  ).split(" ");
  const covers = (e: BasemapEntry) => !map || covered.includes(e.id);

  return (
    <>
      {active && !covers(active) && (
        <div className="pointer-events-none absolute top-12 left-1/2 z-10 -translate-x-1/2 rounded-md border border-slate-300 bg-white/90 px-3 py-1 text-ui-xs text-slate-600 shadow-sm">
          {active.label} is not available here
        </div>
      )}
      {open && (
        <div className="absolute inset-0 z-10" onClick={() => setOpen(false)} />
      )}
      <div className="absolute top-2 right-2 z-20">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={!map}
          title="Layers"
          className="flex h-[29px] w-[29px] items-center justify-center rounded border border-slate-300 bg-white text-slate-600 shadow-md transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <Layers className="h-[15px] w-[15px]" strokeWidth={1.5} />
        </button>
        {open && (
          <div className="absolute right-0 top-8 min-w-[200px] max-w-[260px] rounded-lg border border-slate-100 bg-white py-1 shadow-xl">
            <div className="px-3 pb-1 pt-1.5 text-ui-xs font-semibold uppercase tracking-wider text-slate-400">
              Basemap
            </div>
            {entries.map((e) => {
              const selected = e.id === activeId;
              const available = covers(e);
              return (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => {
                    selectBasemap(e);
                    setOpen(false);
                  }}
                  title={tooltip(e)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-primary bg-primary"
                        : "border-slate-300",
                    )}
                  >
                    {selected && (
                      <Check
                        className="h-2.5 w-2.5 text-white"
                        strokeWidth={3}
                      />
                    )}
                  </span>
                  <span className="flex flex-col">
                    <span
                      className={cn(
                        "text-ui-sm font-medium",
                        !available
                          ? "text-slate-400"
                          : selected
                            ? "text-primary"
                            : "text-slate-700",
                      )}
                    >
                      {e.label}
                    </span>
                    {!available && (
                      <span className="text-ui-xs text-slate-400">
                        not available here
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {entries.length === 0 && (
              <div className="px-3 py-1.5 text-ui-sm text-slate-500">
                No basemaps configured
              </div>
            )}
            {rejected.length > 0 && (
              <div className="border-t border-slate-100 px-3 pt-1.5 pb-1 text-ui-xs text-slate-500">
                {rejected.length === 1
                  ? rejected[0]
                  : `${rejected.length} problems in map.json, first: ${rejected[0]}`}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
