import { useState } from "react";
import { usePreviewCoverage } from "@/api/coverage";
import { apiErrorMessage, type Field, type Robot } from "@/api/client";
import { Input } from "@/components/ui/Input";
import { formatArea } from "@/lib/units";
import { cn } from "@/lib/utils";
import {
  coverageInputs,
  robotTurningRadius,
  type CoverageStageDraft,
} from "./stageTypes";

interface CoverageStageBodyProps {
  stage: CoverageStageDraft;
  fields: Field[];
  robots: Robot[];
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
  robots,
  onChange,
}: CoverageStageBodyProps) {
  const preview = usePreviewCoverage();
  const [planError, setPlanError] = useState<string | null>(null);

  const robot = robots.find((r) => r.id === stage.params_robot_id);
  // A stage loaded from the mission may name a field or robot that is gone; the select still
  // shows what it names, so the stage can be carried as it is.
  const fieldMissing =
    stage.field_id !== "" && !fields.some((f) => f.id === stage.field_id);
  const robotMissing = stage.params_robot_id !== null && robot === undefined;
  const robotRadius =
    robot?.factsheet?.physical_parameters?.min_turning_radius_m;
  const typedRadius = parseFloat(stage.turning_radius_m);
  const belowRobot =
    robot !== undefined &&
    robotRadius != null &&
    Number.isFinite(typedRadius) &&
    typedRadius < robotRadius;

  const built = coverageInputs(stage);
  const inputError = "error" in built ? built.error : null;
  const canPlan = !preview.isPending && !belowRobot && inputError === null;

  // Any edit after a plan makes the swaths on the map stale until the next Plan.
  function edit(patch: Partial<CoverageStageDraft>) {
    onChange(stage.planned ? { ...patch, dirty: true } : patch);
  }

  // With a robot chosen the radius field stays empty and shows the robot's own as its
  // placeholder, so the plan records the value as the factsheet's and follows the robot.
  function chooseRobot(robotId: string) {
    const chosen = robots.find((r) => r.id === robotId);
    edit({
      params_robot_id: chosen ? robotId : null,
      turning_radius_m: chosen
        ? ""
        : stage.turning_radius_m || robotTurningRadius(robot),
    });
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
      <Labelled label="Field">
        <select
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
        {fields.length === 0 && (
          <p className="text-ui-xs text-t3 mt-1">
            No fields defined. Create one under Fields first.
          </p>
        )}
      </Labelled>

      <div className="grid grid-cols-2 gap-2">
        <Labelled label="Implement width (m)">
          <Input
            mono
            inputMode="decimal"
            placeholder="e.g. 3.0"
            value={stage.operation_width_m}
            onChange={(e) => edit({ operation_width_m: e.target.value })}
          />
        </Labelled>
        <Labelled label="Machine values from">
          <select
            value={stage.params_robot_id ?? MANUAL}
            onChange={(e) => chooseRobot(e.target.value)}
            className={selectClass}
          >
            <option value={MANUAL}>Entered by hand</option>
            {robotMissing && (
              <option value={stage.params_robot_id ?? ""}>
                {stage.params_robot_id} (unknown robot)
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
        <Labelled label="Turning radius (m)">
          <Input
            mono
            inputMode="decimal"
            placeholder={
              robot ? robotTurningRadius(robot) || "from the robot" : "e.g. 1.5"
            }
            value={stage.turning_radius_m}
            onChange={(e) => edit({ turning_radius_m: e.target.value })}
            className={cn(belowRobot && "border-red-400 focus:ring-red-200")}
          />
          {belowRobot && (
            <p className="text-ui-xs text-red-500 mt-1">
              {robot?.id} cannot turn tighter than {robotRadius} m
            </p>
          )}
        </Labelled>
        <Labelled label="Headland (m)">
          <Input
            mono
            inputMode="decimal"
            placeholder={
              stage.turning_radius_m ||
              robotTurningRadius(robot) ||
              "the turning radius"
            }
            value={stage.headland_width_m}
            onChange={(e) => edit({ headland_width_m: e.target.value })}
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

const selectClass =
  "w-full border border-border rounded-md px-3 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition";

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
        {label}
      </span>
      {children}
    </label>
  );
}
