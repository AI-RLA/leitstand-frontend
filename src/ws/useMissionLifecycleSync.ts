import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addTopicListener } from "./client";

/**
 * Refetch mission queries when a mission changes status or is created.
 *
 * Both events are fire-once (not latched); the ["missions"] prefix invalidates
 * the list, the open detail, and its /state in one call.
 */
export function useMissionLifecycleSync(): void {
  const qc = useQueryClient();
  useEffect(
    () =>
      addTopicListener("events/mission", (topic) => {
        if (topic.endsWith("/lifecycle") || topic.endsWith("/created")) {
          void qc.invalidateQueries({ queryKey: ["missions"] });
        }
      }),
    [qc],
  );
}
