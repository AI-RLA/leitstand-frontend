import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useField, useUpdateField } from "@/api/fields";
import { ApiError } from "@/api/client";
import {
  type Stage,
  updateSources,
  setupDrawInteraction,
  DRAW_SOURCES,
  DRAW_LAYERS,
} from "./fieldDrawUtils";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { loadBasemap } from "@/stores/mapView";
import { BasemapControl } from "@/components/map/BasemapControl";
import {
  MAP_SOURCES,
  baseLayers,
} from "@/components/map/BasemapControl.constants";

interface Props {
  id: string;
}

export function FieldEdit({ id }: Props) {
  const navigate = useNavigate();
  const { data: field, isLoading, isError } = useField(id);
  const update = useUpdateField(id);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vertsRef = useRef<[number, number][]>([]);
  const stageRef = useRef<Stage>("drawing");
  const seededRef = useRef(false);

  const [verts, setVertsState] = useState<[number, number][]>([]);
  const [stage, setStageState] = useState<Stage>("drawing");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function setVerts(v: [number, number][]) {
    vertsRef.current = v;
    setVertsState(v);
  }
  function setStage(s: Stage) {
    stageRef.current = s;
    setStageState(s);
  }

  function fitField(m: maplibregl.Map, ring: [number, number][]) {
    if (ring.length < 2) return;
    const lons = ring.map((c) => c[0]);
    const lats = ring.map((c) => c[1]);
    m.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 80, duration: 400 },
    );
  }

  // Seed vertices once field data is available
  useEffect(() => {
    if (!field || seededRef.current) return;
    seededRef.current = true;
    const ring = (field.geometry.coordinates[0] ?? []) as [number, number][];
    const exterior = ring.slice(0, -1);
    setVerts(exterior);
    setName(field.name);
    setNotes(field.notes ?? "");

    const m = mapRef.current;
    if (m && m.isStyleLoaded()) {
      updateSources(m, exterior);
      fitField(m, ring);
    }
  }, [field]);

  useEffect(() => {
    if (!containerRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { ...MAP_SOURCES, ...DRAW_SOURCES },
        layers: [...baseLayers(loadBasemap()), ...DRAW_LAYERS],
      },
      center: [8.020798, 52.286366],
      zoom: 14,
    });
    m.addControl(new maplibregl.NavigationControl(), "bottom-right");
    m.getCanvas().style.cursor = "crosshair";
    // Seed existing polygon then enable interaction after style is parsed.
    // Deferred to style.load because updateSources needs getSource().
    // seededRef.current is always true here: map only mounts after isLoading=false.
    m.once("style.load", () => {
      if (seededRef.current) {
        const v = vertsRef.current;
        updateSources(m, v);
        if (v.length >= 1) fitField(m, [...v, v[0]]);
      }
      setupDrawInteraction(m, vertsRef, stageRef, setVerts);
    });
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, []);

  function undo() {
    const next = vertsRef.current.slice(0, -1);
    setVerts(next);
    if (mapRef.current) updateSources(mapRef.current, next);
  }

  function reset() {
    const original = field
      ? (field.geometry.coordinates[0] as [number, number][]).slice(0, -1)
      : [];
    setVerts(original);
    setStage("drawing");
    setError(null);
    const m = mapRef.current;
    if (m) {
      m.getCanvas().style.cursor = "crosshair";
      updateSources(m, original);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ring: [number, number][] = [...vertsRef.current, vertsRef.current[0]];
    try {
      await update.mutateAsync({
        name,
        geometry: { type: "Polygon", coordinates: [ring] },
        notes: notes || null,
      });
      navigate({ to: "/fields/$id", params: { id } });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Server error ${err.status}: ${err.body}`);
      } else {
        setError("Unexpected error — see console.");
        console.error(err);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-ui-md text-t3">
        Loading…
      </div>
    );
  }
  if (isError || !field) {
    return (
      <div className="flex items-center justify-center h-full text-ui-md text-red-500">
        Field not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      {/* Toolbar */}
      <div className="bg-white border-b border-border px-4 h-11 flex items-center gap-3 shrink-0">
        <span className="text-ui-md font-semibold text-t1">
          Edit: {field.name}
        </span>
        <div className="w-px h-4 bg-border shrink-0" />
        {stage === "drawing" ? (
          <span className="text-ui-sm text-t3 flex items-center gap-1.5">
            {verts.length === 0 ? (
              "Click to place vertices"
            ) : verts.length < 3 ? (
              <>
                <span className="inline-flex items-center justify-center bg-[#F1F5F9] text-t2 font-semibold font-mono text-ui-xs rounded px-1.5 py-0.5 tabular-nums">
                  {verts.length}
                </span>
                point{verts.length === 1 ? "" : "s"} — need at least 3
              </>
            ) : (
              <>
                <span className="inline-flex items-center justify-center bg-[#DCFCE7] text-[#15803D] font-semibold font-mono text-ui-xs rounded px-1.5 py-0.5 tabular-nums">
                  {verts.length}
                </span>
                points — click Done or add more
              </>
            )}
          </span>
        ) : (
          <span className="text-ui-sm text-t3 flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center bg-[#DCFCE7] text-[#15803D] font-semibold font-mono text-ui-xs rounded px-1.5 py-0.5 tabular-nums">
              {verts.length}
            </span>
            vertices
          </span>
        )}
        <div className="flex-1" />
        {stage === "drawing" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <button
                onClick={undo}
                disabled={verts.length === 0}
                className="text-ui-sm text-t2 border border-border px-2.5 py-1 rounded-l-md hover:bg-[#F1F5F9] disabled:opacity-40 transition-colors border-r-0"
              >
                Undo
              </button>
              <button
                onClick={reset}
                className="text-ui-sm text-t2 border border-border px-2.5 py-1 rounded-r-md hover:bg-[#F1F5F9] transition-colors"
              >
                Reset
              </button>
            </div>
            <button
              onClick={() => {
                setStage("naming");
                if (mapRef.current)
                  mapRef.current.getCanvas().style.cursor = "default";
              }}
              disabled={verts.length < 3}
              className="text-ui-sm bg-primary text-white px-3.5 py-1 rounded-md font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Done
            </button>
          </div>
        )}
        {stage === "naming" && (
          <button
            onClick={() => {
              setStage("drawing");
              if (mapRef.current)
                mapRef.current.getCanvas().style.cursor = "crosshair";
            }}
            className="text-ui-sm text-t2 border border-border px-2.5 py-1 rounded-md hover:bg-[#F1F5F9] transition-colors"
          >
            Redraw
          </button>
        )}
      </div>

      {/* Map + naming panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0" />
          <BasemapControl mapRef={mapRef} />
        </div>

        {stage === "naming" && (
          <div className="w-[272px] bg-white border-l border-border flex flex-col overflow-y-auto shrink-0">
            <div className="px-4 py-3 border-b border-border bg-[#F8FAFC] shrink-0">
              <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold mb-2">
                Polygon
              </p>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(verts.length, 8) }).map(
                  (_, i) => (
                    <span
                      key={i}
                      className="inline-block w-[6px] h-[6px] rounded-full bg-primary"
                    />
                  ),
                )}
                {verts.length > 8 && (
                  <span className="text-ui-xs text-t3 font-mono">
                    +{verts.length - 8}
                  </span>
                )}
                <span className="ml-auto text-ui-sm font-semibold text-t1 tabular-nums">
                  {verts.length} vertices
                </span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                  Field name
                </span>
                <Input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                  Notes{" "}
                  <span className="ml-1 normal-case font-normal text-t3 tracking-normal">
                    (optional)
                  </span>
                </span>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {error && (
                <p className="text-ui-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 leading-relaxed">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={update.isPending}
                className="bg-primary text-white text-ui-md font-semibold py-2.5 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity mt-1"
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
