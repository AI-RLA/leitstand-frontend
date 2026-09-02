import { EmptyState } from "@/components/ui/EmptyState";

/**
 * What the system noticed on its own, as opposed to what the operator asked.
 *
 * Empty because no agent runs yet. It ships visible anyway: a tab that appears only once a feature
 * exists leaves the operator unable to tell a quiet watch from an absent one, and that distinction
 * is the whole value of a watch.
 */
export function AgentsPanel() {
  return (
    <div className="p-4">
      <EmptyState
        title="No agents running"
        hint="The mission watchdog will report stalled and lost missions here. Nothing is watching yet, so a quiet list means only that."
      />
    </div>
  );
}
