import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useCloseMissionRun, useMission } from "@/api/missions";
import { useAnnotateRun, useRun, useRunState } from "@/api/runs";
import { useSites } from "@/api/sites";
import { useFields } from "@/api/fields";
import { useRobots } from "@/api/robots";
import { apiErrorMessage } from "@/api/client";
import { useArmed } from "@/lib/useArmed";
import { useNowTick } from "@/lib/useNowTick";
import { useMissionState } from "@/ws/missionState";
import { isActiveStatus, runProgress, stageViewModels } from "./adapters";
import { MissionFailureCard } from "./components/MissionFailureCard";
import { MissionPathPreview } from "./components/MissionPathPreview";
import { MissionStageTimeline } from "./components/MissionStageTimeline";
import { RunHeader } from "./components/RunHeader";
import { RunStatusLine } from "./components/RunStatusLine";
import { MapErrorBoundary } from "@/components/map/MapErrorBoundary";

interface Props {
  missionId: string;
  runId: string;
}

/**
 * One run: the plan it executed, frozen at dispatch, with what each stage did.
 *
 * Live only while the run is active; a finished run is read once and never changes, so its
 * map and cards are what happened, not what the mission looks like now.
 */
export function RunDetail({ missionId, runId }: Props) {
  const { data: mission, isLoading: missionLoading } = useMission(missionId);
  const {
    data: run,
    isLoading: runLoading,
    isError,
  } = useRun(missionId, runId);
  const isLoading = runLoading || (missionLoading && !mission);
  const active = isActiveStatus(run?.status);
  const now = useNowTick(1000, active);
  const { data: robots = [] } = useRobots();
  const { data: sites = [] } = useSites();
  const { data: fields = [] } = useFields();
  const live = useMissionState(active ? missionId : null, runId);
  // REST /state is the durable per-stage source for a run that is not active, because the WS
  // latch is in-process and does not survive a backend restart.
  const durable = useRunState(missionId, runId, !!run && !active);
  const annotate = useAnnotateRun(missionId, runId);
  const close = useCloseMissionRun(missionId);
  const [closeArmed, setCloseArmed] = useArmed();

  // The field is seeded from the run once it loads and otherwise left alone: a re-render while
  // the operator types must not overwrite what they wrote.
  const [notes, setNotes] = useState<string | null>(null);
  const shownNotes = notes ?? run?.notes ?? "";

  const state = active ? live : (durable.data ?? null);
  // One walk of the stages per state change, not one per second: the timeline and the progress
  // bar share it while the clock ticks.
  const stages = useMemo(
    () => (run ? stageViewModels(run.stages, state) : []),
    [run, state],
  );
  const coverageFields = useMemo(() => {
    const ids = new Set(
      (run?.stages ?? []).flatMap((s) =>
        s.kind === "coverage" ? [s.provenance.field_id] : [],
      ),
    );
    return fields.filter((f) => ids.has(f.id));
  }, [run, fields]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-t3">Loading…</span>
      </div>
    );
  }
  if (isError || !run || !mission) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-red-500">Run not found.</span>
      </div>
    );
  }

  const started = run.dispatched_at ?? run.created_at;
  const robot = robots.find((r) => r.id === run.robot_id);
  const definitionChanged = run.stages_digest !== mission.stages_digest;
  const overallProgress = active ? runProgress(stages).overallProgress : null;

  async function handleClose() {
    if (!closeArmed) {
      setCloseArmed(true);
      return;
    }
    try {
      await close.mutateAsync(run?.run_id ?? null);
    } catch {
      // shown below the status line
    } finally {
      setCloseArmed(false);
    }
  }

  function saveNotes() {
    const next = shownNotes.trim() || null;
    if (next === (run?.notes ?? null)) return;
    annotate.mutate(next);
  }

  return (
    <div className="p-6 min-h-full flex flex-col [@container(min-width:53.5rem)]:h-full">
      <div className="shrink-0 mb-4">
        <nav className="flex items-center gap-1 text-ui-sm text-t3 mb-1">
          <Link to="/missions" className="hover:text-t1 transition-colors">
            Missions
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link
            to="/missions/$id"
            params={{ id: missionId }}
            className="hover:text-t1 transition-colors truncate"
          >
            {mission.name}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-t2">
            Run of {new Date(started).toLocaleDateString()}
          </span>
        </nav>
        <RunHeader
          mission={mission}
          run={run}
          robot={robot}
          now={now}
          live={active && !!live}
        />
        <RunStatusLine
          run={run}
          transitions={run.transitions}
          robot={robot}
          now={now}
          onClose={active ? () => void handleClose() : undefined}
          closeArmed={closeArmed}
        />
        {close.isError && (
          <p className="text-ui-sm text-red-500 mt-1">
            {apiErrorMessage(close.error)}
          </p>
        )}
        {definitionChanged && (
          <p className="text-ui-xs text-t3 mt-1">
            This run's plan; the definition changed{" "}
            {new Date(mission.updated_at).toLocaleString()}.
          </p>
        )}
        {active && (
          <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(overallProgress ?? 0) * 100}%` }}
            />
          </div>
        )}
      </div>

      {run.failure_errors && run.failure_errors.length > 0 && (
        <div className="shrink-0">
          <MissionFailureCard errors={run.failure_errors} />
        </div>
      )}

      {/* Wraps on room available rather than on a viewport breakpoint: the side panel takes width
          the window says nothing about. */}
      <div className="flex flex-wrap gap-6 [@container(min-width:53.5rem)]:flex-1 [@container(min-width:53.5rem)]:min-h-0">
        <div className="flex-1 basis-[24rem] max-w-[30rem] min-w-0 [@container(min-width:53.5rem)]:overflow-y-auto">
          <div className="mb-3">
            <MissionStageTimeline
              stages={stages}
              statePending={!active && !state && durable.isLoading}
            />
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-3">
            <label
              className="block text-ui-sm font-semibold text-t1 mb-1"
              htmlFor="run-notes"
            >
              Notes
            </label>
            <textarea
              id="run-notes"
              value={shownNotes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              placeholder="Conditions, observations, anything worth knowing about this run."
              className="w-full border border-border rounded-md px-2 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
            {annotate.isError && (
              <p className="text-ui-xs text-red-500 mt-1">
                Could not save the notes.
              </p>
            )}
          </div>
        </div>
        <div className="flex-[2] basis-[28rem] min-w-0 flex [@container(max-width:53.5rem)]:order-first">
          <div className="flex-1 h-[60vh] min-h-[20rem] sticky top-0 [@container(min-width:53.5rem)]:h-full">
            <MapErrorBoundary>
              <MissionPathPreview
                stages={run.stages}
                fitKey={run.run_id}
                state={state}
                sites={sites}
                siteAnchors={run.site_anchors}
                fields={coverageFields}
                robotId={active ? run.robot_id : null}
              />
            </MapErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
