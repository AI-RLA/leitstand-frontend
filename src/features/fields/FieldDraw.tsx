import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCreateField } from "@/api/fields";
import { ApiError } from "@/api/client";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { DrawLayer, type Vertex } from "@/components/map/draw/DrawLayer";

type Stage = "drawing" | "naming";

export function FieldDraw() {
  const navigate = useNavigate();
  const create = useCreateField();

  const [verts, setVerts] = useState<Vertex[]>([]);
  const [stage, setStage] = useState<Stage>("drawing");
  const [cursor, setCursor] = useState("crosshair");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function undo() {
    setVerts((v) => v.slice(0, -1));
  }

  function reset() {
    setVerts([]);
    setStage("drawing");
    setError(null);
  }

  function finishDrawing() {
    setStage("naming");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ring: Vertex[] = [...verts, verts[0]];
    try {
      const field = await create.mutateAsync({
        name,
        geometry: { type: "Polygon", coordinates: [ring] },
        notes: notes || null,
      });
      navigate({ to: "/fields/$id", params: { id: field.id } });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Server error ${err.status}: ${err.body}`);
      } else {
        setError("Unexpected error — see console.");
        console.error(err);
      }
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      {/* Toolbar */}
      <div className="bg-white border-b border-border px-4 h-11 flex items-center gap-3 shrink-0">
        <span className="text-ui-md font-semibold text-t1">New field</span>
        <div className="w-px h-4 bg-border shrink-0" />
        {stage === "drawing" ? (
          <span className="text-ui-sm text-t3 flex items-center gap-1.5">
            {verts.length === 0 ? (
              "Click the map to place vertices"
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
                points placed — click Done or add more
              </>
            )}
          </span>
        ) : (
          <span className="text-ui-sm text-t3 flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center bg-[#DCFCE7] text-[#15803D] font-semibold font-mono text-ui-xs rounded px-1.5 py-0.5 tabular-nums">
              {verts.length}
            </span>
            vertices — name your field
          </span>
        )}
        <div className="flex-1" />
        {stage === "drawing" && (
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
              disabled={verts.length === 0}
              className="text-ui-sm text-t2 border border-border px-2.5 py-1 rounded-r-md hover:bg-[#F1F5F9] disabled:opacity-40 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={finishDrawing}
              disabled={verts.length < 3}
              className="ml-2 text-ui-sm bg-primary text-white px-3.5 py-1 rounded-md font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Done
            </button>
          </div>
        )}
        {stage === "naming" && (
          <button
            onClick={reset}
            className="text-ui-sm text-t2 border border-border px-2.5 py-1 rounded-md hover:bg-[#F1F5F9] transition-colors"
          >
            Redraw
          </button>
        )}
      </div>

      {/* Map + naming panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <LeitstandMap
            view={{ center: [8.020798, 52.286366], zoom: 14 }}
            cursor={cursor}
          >
            <DrawLayer
              vertices={verts}
              onChange={setVerts}
              enabled={stage === "drawing"}
              onCursor={setCursor}
            />
          </LeitstandMap>
        </div>

        {stage === "naming" && (
          <div className="w-[272px] bg-white border-l border-border flex flex-col overflow-y-auto shrink-0">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-border bg-muted shrink-0">
              <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold mb-2">
                Polygon drawn
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
            {/* Form */}
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
                  placeholder="e.g. Nordwiese"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                  Notes
                  <span className="ml-1 normal-case font-normal text-t3 tracking-normal">
                    (optional)
                  </span>
                </span>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Soil type, irrigation, etc."
                />
              </label>
              {error && (
                <p className="text-ui-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 leading-relaxed">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={create.isPending}
                className="bg-primary text-white text-ui-md font-semibold py-2.5 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity mt-1"
              >
                {create.isPending ? "Saving…" : "Create field"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
