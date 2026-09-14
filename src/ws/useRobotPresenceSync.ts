import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ROBOTS_KEY } from "@/api/robots";
import { addTopicListener } from "./client";

/**
 * Refetch the robot list when a robot's derived status changes.
 *
 * Only the list endpoint composes the robot row, and the status frame is latched, so it marks
 * the row stale both on a change and on a reconnect replay, which a fire-once event cannot do.
 */
export function useRobotPresenceSync(): void {
  const qc = useQueryClient();
  useEffect(
    () =>
      addTopicListener("events/robot", (topic) => {
        if (topic.endsWith("/status")) {
          void qc.invalidateQueries({ queryKey: ROBOTS_KEY });
        }
      }),
    [qc],
  );
}
