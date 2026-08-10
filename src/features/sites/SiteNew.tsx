import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useCreateSite } from "@/api/sites";
import { CompassDial } from "@/components/ui/CompassDial";
import { Input } from "@/components/ui/Input";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { Textarea } from "@/components/ui/Textarea";
import { SiteCreateMap, type SiteCreateStep } from "./components/SiteCreateMap";

const STEP_LABELS = ["Anchor", "Heading", "Outline"] as const;
const STEP_KEYS: SiteCreateStep[] = [
  "place-anchor",
  "set-heading",
  "trace-outline",
];

function indexOfStep(s: SiteCreateStep): number {
  if (s === "done") return STEP_KEYS.length;
  return STEP_KEYS.indexOf(s);
}

export function SiteNew() {
  const navigate = useNavigate();
  const create = useCreateSite();

  const [step, setStep] = useState<SiteCreateStep>("place-anchor");
  const [name, setName] = useState("");
  const [nav2MapRef, setNav2MapRef] = useState("");
  const [description, setDescription] = useState("");
  const [anchor, setAnchorState] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [heading, setHeading] = useState(0);
  const [outline, setOutline] = useState<[number, number][]>([]);

  function handleAnchorChange(next: { lat: number; lon: number }) {
    const isFirst = !anchor;
    setAnchorState(next);
    if (isFirst && step === "place-anchor") setStep("set-heading");
  }

  function startTrace() {
    setStep("trace-outline");
  }
  function finishTrace() {
    setStep("done");
  }
  function clearOutline() {
    setOutline([]);
  }
  function undoOutline() {
    setOutline((prev) => prev.slice(0, -1));
  }

  const canSave =
    name.trim().length > 0 &&
    nav2MapRef.trim().length > 0 &&
    anchor !== null &&
    Number.isFinite(heading);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !anchor) return;
    const site = await create.mutateAsync({
      name: name.trim(),
      anchor_lat: anchor.lat,
      anchor_lon: anchor.lon,
      anchor_heading_deg: heading,
      nav2_map_ref: nav2MapRef.trim(),
      description: description.trim() || null,
      outline:
        outline.length >= 3
          ? {
              type: "Polygon",
              coordinates: [
                [
                  ...outline.map(
                    ([lng, lat]) => [lng, lat] as [number, number],
                  ),
                  [outline[0][0], outline[0][1]] as [number, number],
                ],
              ],
            }
          : null,
    });
    navigate({ to: "/sites/$id", params: { id: site.site_id } });
  }

  const completedIndices: number[] = [];
  if (anchor) completedIndices.push(0);
  if (anchor) completedIndices.push(1);
  if (outline.length >= 3) completedIndices.push(2);

  return (
    <form
      onSubmit={handleSubmit}
      className="h-full flex overflow-hidden bg-[#F8FAFC]"
    >
      {/* Left form pane */}
      <div className="w-[480px] shrink-0 flex flex-col border-r border-border bg-white">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <Link
            to="/sites"
            className="inline-flex items-center gap-1 text-ui-xs text-t3 hover:text-t1 transition-colors mb-2"
          >
            <ChevronLeft className="w-3 h-3" />
            Sites
          </Link>
          <h2 className="text-ui-xl font-semibold text-t1 leading-tight mb-3">
            New site
          </h2>
          <StepIndicator
            steps={[...STEP_LABELS]}
            activeIndex={Math.min(indexOfStep(step), STEP_KEYS.length - 1)}
            completedIndices={completedIndices}
            onSelect={(i) => setStep(STEP_KEYS[i])}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Name */}
          <div className="bg-white border border-border rounded-lg p-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Name
              </span>
              <Input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Warehouse A dock"
              />
            </label>
          </div>

          {/* Anchor */}
          <Section
            title="Anchor"
            hint={
              !anchor
                ? "Click the map to place the anchor pin."
                : "Drag the pin on the map to adjust."
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Lat"
                value={anchor ? anchor.lat.toFixed(6) : "—"}
                mono
              />
              <Stat
                label="Lon"
                value={anchor ? anchor.lon.toFixed(6) : "—"}
                mono
              />
            </div>
            {anchor && step !== "place-anchor" && (
              <button
                type="button"
                onClick={() => setStep("place-anchor")}
                className="text-ui-xs text-primary self-start mt-1"
              >
                Move anchor on map
              </button>
            )}
          </Section>

          {/* Heading */}
          <Section
            title="Heading"
            hint="Drag the dial to rotate. The arrow on the map updates live."
          >
            <div className="flex items-center gap-4">
              <CompassDial
                heading={heading}
                size={84}
                onChange={(deg) => setHeading(deg)}
              />
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                  Bearing °
                </span>
                <Input
                  mono
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={Number.isFinite(heading) ? heading : ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) setHeading(v);
                  }}
                />
                <span className="text-ui-xs text-t3">
                  Degrees clockwise from true north, range −180 to 180.
                </span>
              </div>
            </div>
          </Section>

          {/* Outline (optional) */}
          <Section
            title="Outline"
            optional
            hint={
              outline.length === 0
                ? "Skip for a point site, or trace a polygon."
                : step === "trace-outline"
                  ? "Click the map to add boundary points."
                  : `${outline.length} point${outline.length === 1 ? "" : "s"} traced.`
            }
          >
            <div className="flex items-center gap-2">
              {step !== "trace-outline" && outline.length === 0 && (
                <button
                  type="button"
                  onClick={startTrace}
                  disabled={!anchor}
                  className="text-ui-xs text-primary border border-primary/40 rounded px-2.5 py-1 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Trace outline
                </button>
              )}
              {step === "trace-outline" && (
                <>
                  <button
                    type="button"
                    onClick={undoOutline}
                    disabled={outline.length === 0}
                    className="text-ui-xs text-t2 border border-border rounded px-2.5 py-1 hover:bg-[#F8FAFC] transition-colors disabled:opacity-40"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={clearOutline}
                    disabled={outline.length === 0}
                    className="text-ui-xs text-t2 border border-border rounded px-2.5 py-1 hover:bg-[#F8FAFC] transition-colors disabled:opacity-40"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={finishTrace}
                    disabled={outline.length < 3}
                    className="text-ui-xs text-white bg-primary rounded px-3 py-1 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Done
                  </button>
                </>
              )}
              {step !== "trace-outline" && outline.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep("trace-outline")}
                    className="text-ui-xs text-primary border border-primary/40 rounded px-2.5 py-1 hover:bg-primary/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={clearOutline}
                    className="text-ui-xs text-t2 border border-border rounded px-2.5 py-1 hover:bg-[#F8FAFC] transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </Section>

          {/* Map ref + description */}
          <div className="bg-white border border-border rounded-lg p-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Nav2 map ref
              </span>
              <Input
                mono
                required
                value={nav2MapRef}
                onChange={(e) => setNav2MapRef(e.target.value)}
                placeholder="e.g. warehouse_a"
              />
              <span className="text-ui-xs text-t3">
                Opaque identifier the robot resolves to a local map file (e.g.
                via robot.yaml sites list).
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Description{" "}
                <span className="normal-case font-normal tracking-normal">
                  (optional)
                </span>
              </span>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="border-t border-border bg-white px-4 py-3 shrink-0 flex items-center justify-between gap-3">
          <div className="text-ui-xs text-t3 tabular-nums">
            {anchor ? (
              <>
                <span className="text-t2 font-semibold">anchor set</span>
                <span className="mx-1.5">·</span>
                {outline.length >= 3 ? (
                  <span className="text-t2 font-semibold">
                    {outline.length}-point outline
                  </span>
                ) : (
                  <span>no outline</span>
                )}
              </>
            ) : (
              "Click the map to place the anchor"
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/sites" })}
              className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || create.isPending}
              className="text-ui-sm bg-primary text-white px-4 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {create.isPending ? "Saving…" : "Save site"}
            </button>
          </div>
        </div>

        {create.isError && (
          <p className="text-ui-sm text-red-500 px-4 py-2 border-t border-border bg-red-50">
            Failed to create site. Check that all coordinates are valid.
          </p>
        )}
      </div>

      {/* Right map pane */}
      <div className="flex-1 relative overflow-hidden">
        {step === "place-anchor" && !anchor && (
          <ModeBanner>Click the map to place the anchor</ModeBanner>
        )}
        {step === "trace-outline" && (
          <ModeBanner>
            Click to add boundary points
            {outline.length > 0 && (
              <>
                {" "}
                · {outline.length} point{outline.length === 1 ? "" : "s"}
              </>
            )}
          </ModeBanner>
        )}
        <SiteCreateMap
          step={step}
          anchor={anchor}
          heading={heading}
          outline={outline}
          onAnchorChange={handleAnchorChange}
          onOutlineChange={setOutline}
        />
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  optional,
  children,
}: {
  title: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
          {title}
          {optional && (
            <span className="ml-1 normal-case font-normal tracking-normal">
              (optional)
            </span>
          )}
        </span>
        {hint && (
          <span className="text-ui-xs text-t3 text-right ml-3 flex-1 truncate">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
        {label}
      </span>
      <span
        className={`text-ui-sm text-t1 font-medium ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function ModeBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white border border-primary rounded-md shadow-md px-3 py-1.5 text-ui-sm text-t1">
      {children}
    </div>
  );
}
