import { useEffect, useState } from "react";
import { addTopicListener } from "./client";
import type { MissionState } from "@/api/client";

// Validate the payload before trusting it: the topic is exact, but a malformed
// frame must not blank the live UI.
function isMissionState(p: unknown): p is MissionState {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return typeof o.mission_id === "string" && Array.isArray(o.stage_states);
}

/**
 * One WS subscription for a whole list of missions, keyed by mission_id.
 * Use for list/rail views instead of one useMissionState per card.
 */
export function useMissionStates(): Map<string, MissionState> {
  const [states, setStates] = useState<Map<string, MissionState>>(
    () => new Map(),
  );
  useEffect(() => {
    return addTopicListener("events/mission", (topic, payload) => {
      if (!topic.endsWith("/state") || !isMissionState(payload)) return;
      setStates((prev) => {
        const next = new Map(prev);
        next.set(payload.mission_id, payload);
        return next;
      });
    });
  }, []);
  return states;
}

export function useMissionState(missionId: string | null): MissionState | null {
  const [state, setState] = useState<MissionState | null>(null);
  useEffect(() => {
    if (!missionId) return;
    // Clear stale state from the previous mission before the first frame arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(null);
    const topic = `events/mission/${missionId}/state`;
    return addTopicListener(topic, (_topic, payload) => {
      if (isMissionState(payload)) setState(payload);
    });
  }, [missionId]);
  return state;
}
