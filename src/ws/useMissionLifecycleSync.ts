import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MISSIONS_KEY, missionKey } from "@/api/missions";
import { addReconnectListener, addTopicListener } from "./client";

/**
 * Refetch mission queries on fire-once mission events and after a reconnect, since events missed
 * while offline are not replayed.
 */
export function useMissionLifecycleSync(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const removeTopic = addTopicListener("events/mission", (topic) => {
      if (topic.endsWith("/lifecycle")) {
        void qc.invalidateQueries({ queryKey: ["missions"] });
      } else if (topic.endsWith("/created") || topic.endsWith("/changed")) {
        // Every mission query is nested under ["missions", id], so this reaches its runs too.
        const id = topic.split("/")[2];
        void qc.invalidateQueries({ queryKey: MISSIONS_KEY, exact: true });
        if (id) void qc.invalidateQueries({ queryKey: missionKey(id) });
      }
    });
    const removeReconnect = addReconnectListener(() => {
      void qc.invalidateQueries({ queryKey: MISSIONS_KEY });
    });
    return () => {
      removeTopic();
      removeReconnect();
    };
  }, [qc]);
}
