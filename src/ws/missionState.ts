import { useEffect, useState } from "react";
import { addTopicListener } from "./client";
import type { RunState } from "@/api/client";

// Caps the live map: more than any list shows, less than a long session accumulates.
const MAX_TRACKED_RUNS = 200;

// Validate the payload before trusting it: the topic is exact, but a malformed
// frame must not blank the live UI.
function isRunState(p: unknown): p is RunState {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.run_id === "string" &&
    typeof o.mission_id === "string" &&
    Array.isArray(o.stage_states)
  );
}

/**
 * One WS subscription for a whole list of missions, keyed by run_id, for list and rail views.
 * Keying by run keeps an older run's frame unreachable by a caller asking for the run it shows.
 */
export function useMissionStates(): Map<string, RunState> {
  const [states, setStates] = useState<Map<string, RunState>>(() => new Map());
  useEffect(() => {
    return addTopicListener("events/mission", (topic, payload) => {
      if (!topic.endsWith("/state") || !isRunState(payload)) return;
      setStates((prev) => {
        const next = new Map(prev);
        next.set(payload.run_id, payload);
        // Runs accumulate where missions did not, so the oldest frames are dropped. A list only
        // ever reads the runs it is showing, and those are the ones still arriving.
        while (next.size > MAX_TRACKED_RUNS) {
          const oldest = next.keys().next();
          if (oldest.done) break;
          next.delete(oldest.value);
        }
        return next;
      });
    });
  }, []);
  return states;
}

/**
 * The live frame of one run. The topic is keyed by mission and its latched frame may belong to
 * an older run, so frames are filtered by run_id.
 */
export function useMissionState(
  missionId: string | null,
  runId: string | null,
): RunState | null {
  const [state, setState] = useState<RunState | null>(null);
  useEffect(() => {
    if (!missionId) return;
    // Clear stale state from the previous mission before the first frame arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(null);
    const topic = `events/mission/${missionId}/state`;
    return addTopicListener(topic, (_topic, payload) => {
      if (!isRunState(payload)) return;
      // Unconditional: with no run selected there is nothing this frame can belong to, and a
      // latched frame from a deleted run would otherwise show on a mission that reads as never run.
      if (payload.run_id !== runId) return;
      setState(payload);
    });
  }, [missionId, runId]);
  return state;
}
