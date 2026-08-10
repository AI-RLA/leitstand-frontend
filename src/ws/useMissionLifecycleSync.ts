import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addTopicListener } from "./client";

/**
 * Refetch mission queries on any mission lifecycle transition. The lifecycle
 * event is fire-once (not latched); the ["missions"] prefix invalidates the
 * list, the open detail, and its /state in one call.
 */
export function useMissionLifecycleSync(): void {
  const qc = useQueryClient();
  useEffect(
    () =>
      addTopicListener("events/mission", (topic) => {
        if (topic.endsWith("/lifecycle")) {
          void qc.invalidateQueries({ queryKey: ["missions"] });
        }
      }),
    [qc],
  );
}
