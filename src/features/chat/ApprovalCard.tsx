import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useField } from "@/api/fields";
import { useMission, useMissions } from "@/api/missions";
import { useRobots } from "@/api/robots";
import { useSite } from "@/api/sites";
import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * A tool call the assistant paused on. The name is the bare operation id (e.g.
 * "dispatch_mission"); `input` is the arguments the model proposed.
 *
 * `decision` is absent while the proposal is still open, and holds what the operator chose once
 * they have answered. It comes from the message part rather than from component state, so an
 * answered card reads the same after switching tabs and its buttons cannot come back to life.
 */
export type PendingApproval = {
  toolName: string;
  input: Record<string, unknown>;
  approvalId: string;
  decision?: "approved" | "denied";
};

type Tone = "warn" | "destructive";

const VERB: Record<string, { label: string; consequence: string; tone: Tone }> =
  {
    create_mission: {
      label: "Create mission",
      consequence: "Adds a new mission as a draft.",
      tone: "warn",
    },
    update_mission: {
      label: "Update mission",
      consequence:
        "Changes this mission's definition. Runs it has already had keep the plan they executed.",
      tone: "warn",
    },
    delete_mission: {
      label: "Delete mission",
      consequence:
        "Deletes a mission that never ran; archives one that has, keeping its runs readable.",
      tone: "destructive",
    },
    assign_mission: {
      label: "Assign mission",
      consequence:
        "Sets the robot this mission runs on by default, without starting it.",
      tone: "warn",
    },
    unassign_mission: {
      label: "Unassign mission",
      consequence: "Clears this mission's default robot.",
      tone: "warn",
    },
    dispatch_mission: {
      label: "Dispatch mission",
      consequence: "Starts a run: commands a physical robot to begin driving.",
      tone: "warn",
    },
    cancel_mission: {
      label: "Cancel mission",
      consequence: "Stops the mission's run and the robot.",
      tone: "destructive",
    },
    pause_mission: {
      label: "Pause mission",
      consequence: "Holds the robot in place.",
      tone: "warn",
    },
    resume_mission: {
      label: "Resume mission",
      consequence: "Commands the robot to move again.",
      tone: "warn",
    },
    restore_mission: {
      label: "Restore mission",
      consequence: "Brings an archived mission back into the list.",
      tone: "warn",
    },
    plan_coverage_mission: {
      label: "Plan coverage of",
      consequence:
        "Derives a path over the whole field and adds it as a draft mission. Nothing drives until you dispatch it.",
      tone: "warn",
    },
    create_field: {
      label: "Create field",
      consequence: "Adds a new field to the catalog.",
      tone: "warn",
    },
    update_field: {
      label: "Update field",
      consequence: "Changes this field's name, notes or boundary.",
      tone: "warn",
    },
    delete_field: {
      label: "Delete field",
      consequence: "Permanently deletes this field. This cannot be undone.",
      tone: "destructive",
    },
    create_site: {
      label: "Create site",
      consequence: "Adds a new site to the catalog.",
      tone: "warn",
    },
    update_site: {
      label: "Update site",
      consequence: "Changes this site's definition.",
      tone: "warn",
    },
    delete_site: {
      label: "Delete site",
      consequence: "Permanently deletes this site. This cannot be undone.",
      tone: "destructive",
    },
  };

const TONE: Record<Tone, { border: string; bg: string; icon: string }> = {
  warn: {
    border: "border-[#FED7AA]",
    bg: "bg-[#FFF7ED]",
    icon: "text-[#C2410C]",
  },
  destructive: {
    border: "border-[#FECACA]",
    bg: "bg-[#FEF2F2]",
    icon: "text-[#DC2626]",
  },
};

/**
 * The arguments with any nested request body flattened in.
 *
 * The proxy is inconsistent about where request-body params land: a dispatch arrives as
 * { mission_id, body: { robot_id } } while an assign is flat { mission_id, robot_id } and a create
 * is flat { name, ... }. Flattening `body` up makes every field readable the same way.
 */
function flattenArgs(input: Record<string, unknown>): Record<string, unknown> {
  const { body, ...rest } = input;
  // Top level wins on a collision, and the order is load-bearing: it carries the path parameters,
  // which are what the request is addressed to, while the body is a payload the endpoint may
  // ignore. Were it the other way round, a second mission_id planted in the body would be the one
  // the card resolved and displayed, while the dispatch went to the one in the path.
  return { ...((body ?? {}) as Record<string, unknown>), ...rest };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * The gate between a proposal and an action that changes the fleet or the catalog.
 *
 * The action and its target are resolved from the backend, never from model text: an operator
 * cannot meaningfully approve a bare id, and a name the model wrote could be anything.
 *
 * Everything the action would apply is either on screen or behind a label stating what it hides,
 * and every value is verbatim. An operator cannot judge what they were not told was there, and
 * rounding a coordinate is interpretation.
 */
export function ApprovalCard({
  approval,
  onDecide,
}: {
  approval: PendingApproval;
  onDecide: (approvalId: string, approved: boolean) => void;
}) {
  const args = flattenArgs(approval.input);
  const base = VERB[approval.toolName] ?? {
    label: approval.toolName,
    consequence: "Changes the fleet.",
    tone: "warn" as Tone,
  };
  // A re-plan rewrites an existing coverage stage's path rather than adding a mission, so the
  // verb's consequence depends on the argument.
  const config =
    approval.toolName === "plan_coverage_mission" && str(args.replan)
      ? {
          ...base,
          consequence:
            "Derives a new path and writes it over the coverage stage named below. The mission keeps its id, its other stages and its past runs.",
          tone: "warn" as Tone,
        }
      : base;
  const tone = TONE[config.tone];
  const decided = approval.decision !== undefined;
  const target = useTargetResolution(approval.toolName, args);
  // Approving is held back until the target is known to exist. Denying never is: refusing an
  // action whose target cannot be confirmed is exactly the right move, and the operator should
  // not have to wait on a lookup to make it.
  const cannotApprove = target.resolving || target.unresolved;

  return (
    <section
      className={`mt-2 rounded-lg border ${tone.border} ${tone.bg} px-3 py-2.5`}
    >
      <div className="flex items-center gap-1.5">
        <AlertTriangle className={`h-3.5 w-3.5 ${tone.icon}`} aria-hidden />
        <Eyebrow>{decided ? "Decided" : "Approval required"}</Eyebrow>
      </div>

      <NamedTarget label={config.label} resolution={target} />
      {/* An irreversible consequence is not a footnote. At the muted tier it renders quieter and
          smaller than the target's own name directly above it, which puts the least emphasis on
          the only sentence that says the action cannot be taken back. Full strength rather than
          red: the border, ground and icon already carry the alarm. */}
      <p
        className={`mt-1 text-ui-sm ${
          config.tone === "destructive" ? "font-medium text-t1" : "text-t3"
        }`}
      >
        {config.consequence}
      </p>

      <Proposal toolName={approval.toolName} args={args} />

      {decided ? (
        <p className="mt-2 text-ui-sm font-medium text-t2">
          {approval.decision === "approved"
            ? "You approved this."
            : "You denied this."}
        </p>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={cannotApprove}
            onClick={() => onDecide(approval.approvalId, true)}
            className="rounded-md bg-primary px-3 py-1 text-ui-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {target.resolving ? "Checking target" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => onDecide(approval.approvalId, false)}
            className="rounded-md border border-border px-3 py-1 text-ui-sm font-medium text-t2 transition-colors hover:border-border-strong hover:bg-muted"
          >
            Deny
          </button>
        </div>
      )}
    </section>
  );
}

/** Identity-only arguments: already stated by the resolved target, so repeating them is noise. */
const IDENTITY_ARGS = new Set([
  "mission_id",
  "field_id",
  "site_id",
  "robot_id",
]);

/**
 * The data this action would apply, in the shape that verb actually carries.
 *
 * Missions get a renderer because their payload is geometry, which a raw dump makes unreadable.
 * Anything else falls back to its own fields, so a verb with no renderer degrades to something
 * legible rather than to nothing.
 */
function Proposal({
  toolName,
  args,
}: {
  toolName: string;
  args: Record<string, unknown>;
}) {
  if (toolName === "create_mission" || toolName === "update_mission")
    return <MissionProposal args={args} />;
  if (toolName === "plan_coverage_mission")
    return <CoverageProposal args={args} />;

  const rest = Object.entries(args).filter(
    ([key, value]) => !IDENTITY_ARGS.has(key) && value !== undefined,
  );
  if (rest.length === 0) return null;
  return (
    <dl className="mt-2 space-y-1">
      {rest.map(([key, value]) => {
        const polygon = polygonOf(value);
        return polygon ? (
          <Boundary key={key} label={key} polygon={polygon} />
        ) : (
          <Field key={key} label={key} value={value} />
        );
      })}
    </dl>
  );
}

type Polygon = { vertices: number[][]; holes: number };

/**
 * The outer ring of a GeoJSON polygon and the number of rings it hides, or nothing if this value
 * is not a polygon.
 *
 * Rings after the first are holes. Only the outer one is drawn, so the count travels with it and
 * the label can name what is missing. Nothing in the fleet draws a hole today, which means one
 * arriving here was invented by the model.
 */
function polygonOf(value: unknown): Polygon | null {
  if (typeof value !== "object" || value === null) return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates))
    return null;
  const ring = geometry.coordinates[0];
  if (!Array.isArray(ring)) return null;
  const vertices = ring.filter(
    (point): point is number[] =>
      Array.isArray(point) &&
      point.length >= 2 &&
      point.every((n) => typeof n === "number"),
  );
  if (vertices.length === 0) return null;
  return { vertices, holes: geometry.coordinates.length - 1 };
}

/**
 * A boundary as its own coordinates, behind a label that counts them.
 *
 * One line of JSON is on screen without being readable, and an approval given against geometry
 * the operator could not read is not oversight. Longitude comes first in GeoJSON and is labelled,
 * since reading a pair the wrong way round puts a field in the wrong hemisphere.
 */
function Boundary({ label, polygon }: { label: string; polygon: Polygon }) {
  const { vertices, holes } = polygon;
  // GeoJSON allows a third ordinate. Nothing draws one today, but dropping it silently is the
  // failure this table exists to correct, so the column appears whenever a vertex carries one.
  const hasAltitude = vertices.some((vertex) => vertex.length > 2);
  const hidden =
    holes > 0
      ? ` · ${holes} interior ring${holes === 1 ? "" : "s"} not shown`
      : "";
  return (
    <Disclosure
      label={`${label} · polygon · vertices (${vertices.length})${hidden}`}
    >
      <table className="w-full text-left font-mono text-ui-xs">
        <thead>
          <tr className="text-t3">
            <th className="pr-2 pb-1 font-medium">#</th>
            <th className="pr-2 pb-1 font-medium">lon</th>
            <th className="pr-2 pb-1 font-medium">lat</th>
            {hasAltitude && <th className="pr-2 pb-1 font-medium">alt</th>}
          </tr>
        </thead>
        <tbody>
          {vertices.map((vertex, i) => (
            <tr key={i} className="text-t1">
              <td className="pr-2 align-top">{i + 1}</td>
              <td className="pr-2 align-top">{verbatim(vertex[0])}</td>
              <td className="pr-2 align-top">{verbatim(vertex[1])}</td>
              {hasAltitude && (
                <td className="pr-2 align-top">{verbatim(vertex[2])}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Disclosure>
  );
}

/** A mission's model-authored scalars stay visible; its geometry sits behind labeled expanders. */
/**
 * What a coverage plan would be laid out from, and where each value came from.
 *
 * The path does not exist yet, so there is no geometry to show and nothing to check it against.
 * What can be checked is the inputs, and the ones that decide whether the machine leaves the
 * field are precisely those the assistant does not send: left out, they are taken from the
 * robot's own declaration, and an operator reading the arguments alone would never learn they
 * were applied. Naming each value's origin is what separates a number the assistant chose, which
 * needs scrutiny, from one the machine declared, which does not.
 */
function CoverageProposal({ args }: { args: Record<string, unknown> }) {
  const robotId = str(args.robot_id);
  const robots = useRobots();
  const robot = robotId
    ? (robots.data ?? []).find((r) => r.id === robotId)
    : undefined;
  const radius = robot?.factsheet?.physical_parameters?.min_turning_radius_m;
  const headland = args.headland_width_m;
  const angle = args.swath_angle_deg;
  const replaces = str(args.replan);
  // Named rather than measured: how far a turn actually reaches is the planner's to compute and
  // report, and a browser estimating it would be guessing at the plan it has not seen.
  const shallow =
    radius !== undefined && typeof headland === "number" && headland < radius;
  return (
    <>
      {/* Ordered as an operator reads it: what this will be called, then the machine, then what
          the pattern will and will not cover. The name appears only when the assistant chose one
          instead of the field's, so the once it shows is the once it is worth reading first. The
          turning radius is not a row because nobody can change it; it belongs to the headland as
          the evidence for it. */}
      <dl className="mt-2 space-y-1.5">
        {str(args.name) !== undefined && (
          <Field label="Name" value={args.name} />
        )}
        {str(args.description) !== undefined && (
          <Field label="Description" value={args.description} />
        )}
        <Detail label="Working width" value={metres(args.operation_width_m)} />
        <Detail
          label="Headland width"
          value={headland === undefined ? metres(radius) : metres(headland)}
          note={
            radius === undefined
              ? undefined
              : headland === undefined
                ? `not specified, so ${robotId ?? "the robot"}'s turning radius`
                : shallow
                  ? `shallower than the ${radius} m ${robotId ?? "the robot"} needs to turn, so turns will leave the field`
                  : `${robotId ?? "the robot"} turns at ${radius} m`
          }
          tone={shallow ? "warn" : undefined}
        />
        <Detail
          label="Last pass"
          value={
            args.allow_overlap === true
              ? "overlaps the one before it to cover the remainder"
              : "leaves the remainder unworked"
          }
        />
        <Detail
          label="Swath angle"
          value={angle === undefined ? "not specified" : `${verbatim(angle)}°`}
        />
      </dl>
      {replaces !== undefined && <Superseded stageId={replaces} />}
    </>
  );
}

/** Render a supplied measurement with its unit, and an absent one as a stated absence. */
function metres(value: unknown): string {
  return typeof value === "number" ? `${value} m` : "not declared";
}

function Detail({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "warn";
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-baseline gap-x-3 text-ui-sm">
      <dt className="text-ui-xs text-t3">{label}</dt>
      {/* The note sits inside the value it qualifies, so it reads as belonging to that row rather
          than as a label of its own. */}
      <dd className="min-w-0 text-t1">
        {value}
        {note ? (
          <span
            className={`mt-0.5 block text-ui-xs ${tone === "warn" ? "font-medium text-[#B45309]" : "text-t2"}`}
          >
            {note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * The mission whose coverage stage this plan would rewrite, resolved from the stage id the
 * proposal names, because the operator should see which plan is about to change.
 */
function Superseded({ stageId }: { stageId: string }) {
  const missions = useMissions();
  const mission = (missions.data ?? []).find((m) =>
    m.stages.some(
      (s) =>
        s.stage_id === stageId ||
        (s.on_cancel ?? []).some((c) => c.stage_id === stageId),
    ),
  );
  const unresolved = missions.isSuccess && mission === undefined;
  return (
    <div className="mt-2 rounded-md border border-[#FDE68A] bg-white px-2.5 py-2">
      <p className="text-ui-sm text-t1">
        Rewrites the path of{" "}
        <span className="font-medium">{mission?.name ?? stageId}</span>
        {mission?.latest_run?.status ? (
          <span className="text-t3">
            {" "}
            (last run {mission.latest_run.status})
          </span>
        ) : null}
        .
      </p>
      <p className="mt-0.5 text-ui-xs text-t3">
        {unresolved
          ? "No mission has a coverage stage with that id, so this may change nothing, or something else."
          : "Its id, name and past runs stay; only that stage's path changes."}
      </p>
    </div>
  );
}

function MissionProposal({ args }: { args: Record<string, unknown> }) {
  const named = new Set(["name", "description", "stages"]);
  // Anything the API grows later still reaches the operator rather than vanishing because no
  // renderer here knows about it.
  const rest = Object.entries(args).filter(
    ([key, value]) =>
      !named.has(key) && !IDENTITY_ARGS.has(key) && value !== undefined,
  );
  return (
    <div className="mt-2">
      <dl className="space-y-1">
        {"name" in args && <Field label="name" value={args.name} />}
        {"description" in args && (
          <Field label="description" value={args.description} />
        )}
        {rest.map(([key, value]) => (
          <Field key={key} label={key} value={value} />
        ))}
      </dl>
      <Stages value={args.stages} />
    </div>
  );
}

/**
 * The mission's stages, or a plain statement that it has none.
 *
 * Rendering nothing when the stages are missing or arrive in an unexpected shape would leave a
 * mission with no waypoints looking exactly like one whose waypoints are merely not on screen.
 * The gate exists so the operator can tell those apart: a mission that cannot run has to say so
 * before it is approved, not fail after.
 */
function Stages({ value }: { value: unknown }) {
  const stages = asStageList(value);
  if (stages && stages.length > 0)
    return (
      <>
        {stages.map((stage, i) => (
          <StageDetails key={i} stage={stage} index={i} />
        ))}
      </>
    );
  if (stages || value === undefined || value === null)
    return (
      <p className="mt-1.5 text-ui-sm text-t2">
        No stages proposed, so this mission has nowhere to drive.
      </p>
    );
  return (
    <>
      <p className="mt-1.5 text-ui-sm font-medium text-[#B91C1C]">
        The stages did not arrive as a list, so they cannot be shown as stages
        and this call will be rejected. What was proposed is below, unchanged.
      </p>
      <dl className="mt-1">
        <Field label="stages" value={value} />
      </dl>
    </>
  );
}

/**
 * The stages as a list, reading a JSON string as one if that is how they arrived.
 *
 * The schema asks for a list and the model sometimes sends the same list encoded as text. Read
 * that way it is a single unreadable line, which hides the geometry this card exists to show, so
 * it is decoded here. Strictly for display: nothing derived here is ever sent, the request still
 * carries exactly what the model proposed, and the backend still rejects the encoded form.
 */
function asStageList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * One stage, collapsed behind a label that names what it hides.
 *
 * Cleanup stages are nested inside the stage they belong to, because that is where they run and
 * an operator approving a cancel path has to be able to find it.
 */
function StageDetails({
  stage,
  index,
  cleanup = false,
}: {
  stage: unknown;
  index: number;
  cleanup?: boolean;
}) {
  const record = (stage ?? {}) as Record<string, unknown>;
  const waypoints = Array.isArray(record.waypoints) ? record.waypoints : [];
  const onCancel = Array.isArray(record.on_cancel) ? record.on_cancel : [];
  const kind = str(record.kind) ?? "kind not set";
  const noun = cleanup ? "Cleanup stage" : "Stage";

  return (
    <Disclosure
      label={`${noun} ${index + 1} · ${kind} · waypoints (${waypoints.length})`}
    >
      <WaypointTable waypoints={waypoints} />
      {onCancel.map((nested, i) => (
        <StageDetails key={i} stage={nested} index={i} cleanup />
      ))}
    </Disclosure>
  );
}

// The two waypoint frames the backend accepts, and the fields each carries in order. A stage is
// meant to be homogeneous, but that is enforced at dispatch rather than by the schema, so the
// columns are the union of the frames actually present and the kind column shows any mixture.
const WAYPOINT_COLUMNS: Record<string, string[]> = {
  wgs84: ["lat", "lon", "heading_deg"],
  site_local: ["x", "y", "theta", "site_id"],
};

function WaypointTable({ waypoints }: { waypoints: unknown[] }) {
  if (waypoints.length === 0)
    return <p className="text-ui-xs text-t3">No waypoints.</p>;
  const rows = waypoints.map((w) => (w ?? {}) as Record<string, unknown>);
  const kinds = new Set(rows.map((r) => str(r.kind) ?? ""));
  const columns = Object.entries(WAYPOINT_COLUMNS)
    .filter(([kind]) => kinds.has(kind))
    .flatMap(([, fields]) => fields);
  // A waypoint whose frame is unrecognised or missing still has to be readable, so fall back to
  // whatever fields it does carry rather than rendering an empty row.
  const fields =
    columns.length > 0
      ? columns
      : [...new Set(rows.flatMap((r) => Object.keys(r)))].filter(
          (f) => f !== "kind",
        );

  return (
    <table className="w-full text-left font-mono text-ui-xs">
      <thead>
        <tr className="text-t3">
          <th className="pr-2 pb-1 font-medium">#</th>
          <th className="pr-2 pb-1 font-medium">kind</th>
          {fields.map((f) => (
            <th key={f} className="pr-2 pb-1 font-medium">
              {f}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="text-t1">
            <td className="pr-2 align-top">{i + 1}</td>
            <td className="pr-2 align-top">{str(row.kind) ?? "not set"}</td>
            {fields.map((f) => (
              <td key={f} className="pr-2 align-top">
                {verbatim(row[f])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Render a value as it was proposed. Never rounded, never shortened. */
function verbatim(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** A collapsed section whose label states exactly what it hides. */
function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 text-ui-xs font-medium text-t2 hover:text-t1"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {label}
      </button>
      {open && (
        <div className="mt-1 rounded border border-border bg-white/60 p-2">
          {children}
        </div>
      )}
    </div>
  );
}

// Longer than this and a value stops being glanceable and starts crowding out everything else.
const INLINE_CHARS = 80;

function isInline(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "object") return false;
  return String(value).length <= INLINE_CHARS;
}

/** What the collapsed label promises: enough to know whether it is worth opening. */
function summarise(value: unknown): string {
  if (Array.isArray(value))
    return `list of ${value.length} ${value.length === 1 ? "item" : "items"}`;
  if (typeof value === "object" && value !== null) return "object";
  return `text, ${String(value).length} characters`;
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (isInline(value))
    return (
      <div className="grid grid-cols-[7rem_1fr] items-baseline gap-x-3 text-ui-sm">
        <dt className="font-mono text-ui-xs text-t3">{label}</dt>
        <dd className="min-w-0 break-words text-t1">{verbatim(value)}</dd>
      </div>
    );
  return (
    <Disclosure label={`${label} · ${summarise(value)}`}>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-ui-xs text-t2">
        {expanded(value)}
      </pre>
    </Disclosure>
  );
}

/** Indent structure so an opened value is readable, still without changing any of it. */
function expanded(value: unknown): string {
  if (typeof value === "object" && value !== null)
    return JSON.stringify(value, null, 2);
  return String(value);
}

type Resolution = {
  name: string;
  meta?: string;
  /**
   * The robot the proposal itself names, kept out of the target's own parenthetical.
   *
   * A coverage plan acts on a field and names a machine, which are two entities rather than one
   * described by the other, so folding the robot in would read as an attribute of the field.
   */
  robot?: { id: string; state?: string };
  /** The backend was asked about this id and could not answer. */
  unresolved: boolean;
  /** The answer has not arrived yet. */
  resolving: boolean;
};

/**
 * Resolve the action's target from the backend, and say so when that fails.
 *
 * The card's premise is that an operator cannot meaningfully approve a bare id, so an id that does
 * not resolve is the one case where the card must not present itself as informative: an id the
 * model invented, or one deleted since it was proposed, would otherwise render as a confident
 * sentence with the raw uuid standing in for a name.
 *
 * All three lookups are declared on every render and only the relevant one is enabled, because a
 * hook cannot be called conditionally. At most one of these ids is present; a create carries none
 * and falls through to the proposed name.
 */
function useTargetResolution(
  toolName: string,
  args: Record<string, unknown>,
): Resolution {
  const missionId = str(args.mission_id);
  const fieldId = str(args.field_id);
  const siteId = str(args.site_id);
  const robotId = str(args.robot_id);
  const mission = useMission(missionId ?? "", { enabled: Boolean(missionId) });
  const field = useField(fieldId ?? "", { enabled: Boolean(fieldId) });
  const site = useSite(siteId ?? "", { enabled: Boolean(siteId) });
  // The robot a dispatch or assign names is model-authored like any other argument, and it decides
  // which machine actually moves. Resolving it against the fleet is what makes the difference
  // between an id that reads plausibly and one that exists.
  const robots = useRobots();

  const named = robotId
    ? (robots.data ?? []).find((r) => r.id === robotId)
    : undefined;
  // Status and battery belong here because acting on an offline or nearly-flat robot is exactly
  // the mistake this gate exists to catch, and the fleet view already has the answer.
  const proposedRobot = robotId
    ? {
        id: robotId,
        state: named
          ? `${named.status}${
              named.battery ? `, ${Math.round(named.battery.battery_pct)}%` : ""
            }`
          : undefined,
      }
    : undefined;
  const robotUnresolved = Boolean(robotId) && !robots.isPending && !named;
  const robotResolving = Boolean(robotId) && robots.isPending;

  if (missionId) {
    // The mission's own robot is named here only when the proposal does not name one itself,
    // since a robot the operator is being asked to commit to is not the same fact as the one the
    // mission already holds.
    const meta = [
      mission.data?.latest_run?.status ?? (mission.data ? "never run" : null),
      robotId ? null : mission.data?.assigned_robot_id,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      name: mission.data?.name ?? missionId,
      meta: meta || undefined,
      robot: proposedRobot,
      unresolved: mission.isError || robotUnresolved,
      resolving: mission.isPending || robotResolving,
    };
  }
  if (fieldId)
    // A field-targeted verb may still name a robot, as planning coverage does. Resolving it here
    // too is what keeps the machine visible: it is stripped from the argument list as an identity,
    // so if this does not show it, nothing does.
    return {
      name: field.data?.name ?? fieldId,
      robot: proposedRobot,
      unresolved: field.isError || robotUnresolved,
      resolving: field.isPending || robotResolving,
    };
  if (siteId)
    return {
      name: site.data?.name ?? siteId,
      unresolved: site.isError,
      resolving: site.isPending,
    };
  // A create names no existing entity, so there is nothing to resolve and nothing to doubt.
  return {
    name: str(args.name) ?? proposedNoun(toolName),
    unresolved: false,
    resolving: false,
  };
}

function proposedNoun(toolName: string): string {
  if (toolName.includes("field")) return "new field";
  if (toolName.includes("site")) return "new site";
  return "new mission";
}

function NamedTarget({
  label,
  resolution,
}: {
  label: string;
  resolution: Resolution;
}) {
  return (
    <>
      <p className="mt-1.5 text-ui-md text-t1">
        {label} <span className="font-medium">{resolution.name}</span>
        {resolution.meta ? (
          <span className="text-t3"> ({resolution.meta})</span>
        ) : null}
        {resolution.robot ? (
          <>
            {" for "}
            <span className="font-medium">{resolution.robot.id}</span>
            {resolution.robot.state ? (
              <span className="text-t3"> ({resolution.robot.state})</span>
            ) : null}
          </>
        ) : null}
        .
      </p>
      {resolution.unresolved && (
        <p className="mt-1 text-ui-sm font-medium text-[#B91C1C]">
          This target could not be found, so what is named above is the
          identifier the assistant supplied, not a confirmed entity. Approval
          stays disabled until it resolves.
        </p>
      )}
    </>
  );
}
