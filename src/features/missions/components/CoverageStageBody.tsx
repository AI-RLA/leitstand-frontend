import { useId, useRef, useState } from "react";
import { usePreviewCoverage } from "@/api/coverage";
import { apiErrorMessage, type Field, type Robot } from "@/api/client";
import { useRobots } from "@/api/robots";
import { isSettled } from "@/api/settled";
import { Input } from "@/components/ui/Input";
import { formatArea, parseDecimal } from "@/lib/units";
import { cn } from "@/lib/utils";
import {
  coverageInputs,
  robotTurningRadius,
  shownHeadland,
  shownTurningRadius,
  type CoverageStageDraft,
  type RadiusEntry,
} from "./stageTypes";

interface CoverageStageBodyProps {
  stage: CoverageStageDraft;
  fields: Field[];
  onChange: (patch: Partial<CoverageStageDraft>) => void;
}

const MANUAL = "";

function planSummary(stage: CoverageStageDraft["planned"]): string {
  if (!stage) return "";
  const { metrics } = stage.provenance;
  const parts = [
    `${metrics.swath_count} swaths`,
    `${formatArea(metrics.covered_area_m2)} worked`,
  ];
  if (metrics.max_excursion_m != null && metrics.max_excursion_m > 0) {
    parts.push(`leaves the field by ${metrics.max_excursion_m.toFixed(1)} m`);
  }
  return parts.join(" · ");
}

export function CoverageStageBody({
  stage,
  fields,
  onChange,
}: CoverageStageBodyProps) {
  const preview = usePreviewCoverage();
  const robotsQuery = useRobots();
  const robots = robotsQuery.data ?? [];
  const [planError, setPlanError] = useState<string | null>(null);
  const radiusInput = useRef<HTMLInputElement>(null);
  const headlandInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const fieldHint = `${id}-field`;
  const robotHint = `${id}-robot`;
  const radiusHint = `${id}-radius`;
  const headlandHint = `${id}-headland`;

  const robot = robots.find((r) => r.id === stage.params_robot_id);
  // A stage loaded from the mission may name a field or robot that is gone; the select still
  // shows what it names, so the stage can be carried as it is.
  const fieldMissing =
    stage.field_id !== "" && !fields.some((f) => f.id === stage.field_id);
  const robotUnlisted = stage.params_robot_id !== null && robot === undefined;
  const robotRadius =
    robot?.factsheet?.physical_parameters?.min_turning_radius_m;
  const radiusShown = shownTurningRadius(stage, robot);
  const radiusDerived =
    stage.turning_radius.from !== "manual" ||
    stage.turning_radius.seeded === true;
  const headlandShown = shownHeadland(stage, robot);
  const headlandDerived = stage.headland.from !== "manual";
  const typedRadius =
    stage.turning_radius.from === "manual"
      ? parseDecimal(stage.turning_radius.value)
      : NaN;
  const belowRobot =
    robotRadius != null &&
    Number.isFinite(typedRadius) &&
    typedRadius < robotRadius;
  // Planning for a named robot reads its physical parameters, even for values entered manually.
  const robotUsable = stage.params_robot_id === null || robotRadius != null;
  const robotProblem = robotUsable ? null : describeRobotProblem();

  // Before the robot list has loaded every robot looks unknown, so no problem is named until then.
  function describeRobotProblem(): string | null {
    if (robot) return `${robot.id} states no turning radius`;
    if (robotsQuery.isSuccess)
      return `${stage.params_robot_id} is not a known robot`;
    return isSettled(robotsQuery) ? "The robot list could not be loaded" : null;
  }

  const built = coverageInputs(stage);
  const inputError = "error" in built ? built.error : null;
  const canPlan =
    !preview.isPending && !belowRobot && robotUsable && inputError === null;

  // Any edit after a plan makes the swaths on the map stale until the next Plan.
  function edit(patch: Partial<CoverageStageDraft>) {
    onChange(stage.planned ? { ...patch, dirty: true } : patch);
  }

  function chooseRobot(robotId: string) {
    const chosen = robots.find((r) => r.id === robotId);
    edit({
      params_robot_id: chosen ? robotId : null,
      turning_radius: radiusAfterRobotChange(chosen),
    });
  }

  // A radius the operator typed is kept, so a robot switch never replaces it silently.
  function radiusAfterRobotChange(chosen: Robot | undefined): RadiusEntry {
    const current = stage.turning_radius;
    if (current.from === "manual" && !current.seeded && current.value.trim()) {
      return current;
    }
    if (robotTurningRadius(chosen)) return { from: "robot" };
    if (chosen) return { from: "manual", value: "" };
    return { from: "manual", value: radiusShown, seeded: true };
  }

  // The link that was clicked disappears, so the focus moves to the value it filled in.
  function fillFromSource(
    patch: Partial<CoverageStageDraft>,
    input: React.RefObject<HTMLInputElement | null>,
  ) {
    edit(patch);
    input.current?.focus();
    requestAnimationFrame(() => input.current?.select());
  }

  async function plan() {
    if (!("inputs" in built)) return;
    setPlanError(null);
    try {
      const planned = await preview.mutateAsync(built.inputs);
      onChange({ planned, dirty: false });
    } catch (error) {
      setPlanError(apiErrorMessage(error));
    }
  }

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <Labelled
        label="Field"
        hintId={fieldHint}
        hint={
          fields.length === 0 && (
            <p className="text-ui-xs text-t3">
              No fields defined. Create one under Fields first.
            </p>
          )
        }
      >
        <select
          aria-describedby={fieldHint}
          value={stage.field_id}
          onChange={(e) => edit({ field_id: e.target.value })}
          className={selectClass}
        >
          <option value="">Select field…</option>
          {fieldMissing && (
            <option value={stage.field_id}>deleted field</option>
          )}
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.area_ha != null ? ` (${f.area_ha.toFixed(2)} ha)` : ""}
            </option>
          ))}
        </select>
      </Labelled>

      <div className="grid grid-cols-2 gap-2">
        <Labelled label="Working width (m)">
          <Input
            mono
            inputMode="decimal"
            placeholder="e.g. 3.0"
            value={stage.operation_width_m}
            onChange={(e) => edit({ operation_width_m: e.target.value })}
          />
        </Labelled>
        <Labelled
          label="Machine values from"
          hintId={robotHint}
          hint={
            robotProblem && (
              <p className="text-ui-xs text-red-500">
                {robotProblem}. Select another robot or Manual entry.
              </p>
            )
          }
        >
          <select
            aria-describedby={robotHint}
            aria-invalid={robotProblem !== null}
            value={stage.params_robot_id ?? MANUAL}
            onChange={(e) => chooseRobot(e.target.value)}
            className={selectClass}
          >
            <option value={MANUAL}>Manual entry</option>
            {robotUnlisted && (
              <option value={stage.params_robot_id ?? ""}>
                {stage.params_robot_id}
                {robotsQuery.isSuccess ? " (unknown robot)" : ""}
              </option>
            )}
            {robots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id}
              </option>
            ))}
          </select>
        </Labelled>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Labelled
          label="Turning radius (m)"
          hintId={radiusHint}
          hint={
            <>
              {robot &&
                robotRadius != null &&
                (stage.turning_radius.from === "robot" ? (
                  <ValueSource>
                    {radiusShown === robotTurningRadius(robot)
                      ? `from ${robot.id}`
                      : `from ${robot.id} when planned, now ${robotRadius} m`}
                    {radiusShown === "0" ? ", turns on the spot" : ""}
                  </ValueSource>
                ) : (
                  <UseSource
                    onClick={() =>
                      fillFromSource(
                        { turning_radius: { from: "robot" } },
                        radiusInput,
                      )
                    }
                  >
                    use {robotRadius} m from {robot.id}
                  </UseSource>
                ))}
              {belowRobot && (
                <p className="text-ui-xs text-red-500">
                  {robot?.id} cannot turn tighter than {robotRadius} m
                </p>
              )}
            </>
          }
        >
          <Input
            ref={radiusInput}
            aria-describedby={radiusHint}
            aria-invalid={belowRobot}
            mono
            inputMode="decimal"
            placeholder="e.g. 1.5"
            value={radiusShown}
            {...replacedWhenTyped(radiusDerived)}
            onChange={(e) =>
              edit({
                turning_radius: { from: "manual", value: e.target.value },
              })
            }
            className={cn(belowRobot && "border-red-400 focus:ring-red-200")}
          />
        </Labelled>
        <Labelled
          label="Headland width (m)"
          hintId={headlandHint}
          hint={
            stage.headland.from === "radius" ? (
              <ValueSource>from the turning radius</ValueSource>
            ) : (
              <UseSource
                onClick={() =>
                  fillFromSource(
                    { headland: { from: "radius" } },
                    headlandInput,
                  )
                }
              >
                use the turning radius
              </UseSource>
            )
          }
        >
          <Input
            ref={headlandInput}
            aria-describedby={headlandHint}
            mono
            inputMode="decimal"
            placeholder="e.g. 1.5"
            value={headlandShown}
            {...replacedWhenTyped(headlandDerived)}
            onChange={(e) =>
              edit({ headland: { from: "manual", value: e.target.value } })
            }
          />
        </Labelled>
      </div>

      <div className="grid grid-cols-2 gap-2 items-end">
        <Labelled label="Swath direction (°)">
          <Input
            mono
            inputMode="decimal"
            placeholder="auto"
            value={stage.swath_angle_deg}
            onChange={(e) => edit({ swath_angle_deg: e.target.value })}
          />
        </Labelled>
        <label className="flex items-center gap-2 text-ui-sm text-t2 pb-2">
          <input
            type="checkbox"
            checked={stage.allow_overlap}
            onChange={(e) => edit({ allow_overlap: e.target.checked })}
            className="accent-primary"
          />
          Last pass may overlap
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-0.5">
        <button
          type="button"
          onClick={plan}
          disabled={!canPlan}
          className="text-ui-sm bg-primary text-white px-3 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {preview.isPending
            ? "Planning…"
            : stage.planned
              ? "Plan again"
              : "Plan"}
        </button>
        {inputError && !preview.isPending && (
          <span className="text-ui-xs text-t3">{inputError}</span>
        )}
        {stage.planned && !stage.dirty && (
          <span className="text-ui-xs text-t2 tabular-nums">
            {planSummary(stage.planned)}
          </span>
        )}
        {stage.planned && stage.dirty && (
          <span className="text-ui-xs text-amber-600">
            Plan again before saving
          </span>
        )}
      </div>
      {planError && <p className="text-ui-xs text-red-500">{planError}</p>}
    </div>
  );
}

// Typing over a value read from its source replaces it instead of appending to it.
function replacedWhenTyped(derived: boolean) {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      if (derived) e.currentTarget.select();
    },
    onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
      if (derived) e.preventDefault();
    },
  };
}

const selectClass =
  "w-full border border-border rounded-md px-3 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition";

function ValueSource({ children }: { children: React.ReactNode }) {
  return <span className="text-ui-xs text-t3">{children}</span>;
}

function UseSource({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ui-xs text-primary hover:underline self-start"
    >
      {children}
    </button>
  );
}

// The hint sits outside the label, so its text and buttons are not part of the control's name.
function Labelled({
  label,
  hint,
  hintId,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  hintId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
          {label}
        </span>
        {children}
      </label>
      {/* Always rendered, so the control's aria-describedby never names a missing element. */}
      <div id={hintId} className="flex flex-col gap-1 empty:hidden">
        {hint}
      </div>
    </div>
  );
}
