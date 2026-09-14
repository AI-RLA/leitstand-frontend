import { Link } from "@tanstack/react-router";
import { useMissions } from "@/api/missions";
import { StatusPill } from "@/components/ui/StatusPill";
import { missionsUsingSite } from "../adapters";

interface SiteUsagePanelProps {
  siteId: string;
}

export function SiteUsagePanel({ siteId }: SiteUsagePanelProps) {
  const { data: missions = [] } = useMissions();
  const using = missionsUsingSite(siteId, missions);

  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden mb-3">
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
          {using.length === 0
            ? "Not used yet"
            : `Used by ${using.length} mission${using.length === 1 ? "" : "s"}`}
        </p>
      </div>
      {using.length === 0 ? (
        <p className="px-4 py-3 text-ui-sm text-t3">
          No missions reference this site.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {using.map((m) => (
            <Link
              key={m.mission_id}
              to="/missions/$id"
              params={{ id: m.mission_id }}
              className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-muted transition-colors"
            >
              <span className="text-ui-sm text-t1 font-medium truncate">
                {m.name}
              </span>
              <StatusPill
                variant="mission"
                status={m.latest_run?.status ?? null}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
