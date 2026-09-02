import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useSites } from "@/api/sites";
import { useMissions } from "@/api/missions";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { toSiteViewModel } from "../adapters";
import { SiteCard } from "./SiteCard";

type SortKey = "recent" | "name";

export function SitesSidebar() {
  const { data: sites, isLoading } = useSites();
  const { data: missions = [] } = useMissions();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const vms = useMemo(
    () => (sites ?? []).map((s) => toSiteViewModel(s, missions)),
    [sites, missions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? vms.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.nav2MapRef.toLowerCase().includes(q),
        )
      : vms;
    return [...matches].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      // recent: lastUsedAt desc with nulls last; then updatedAt desc.
      // Compare as epoch ms (not lexically) so timezone/precision variants order right.
      if (a.lastUsedAt && b.lastUsedAt) {
        return Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt);
      }
      if (a.lastUsedAt) return -1;
      if (b.lastUsedAt) return 1;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
  }, [vms, query, sort]);

  return (
    <aside className="h-full bg-white border-r border-border flex flex-col">
      <div className="px-3 pt-3 pb-2 border-b border-border flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-ui-sm uppercase tracking-wider text-t3 font-semibold">
            Sites ({sites?.length ?? 0})
          </span>
          <Link
            to="/sites/new"
            className={cn(
              "text-ui-xs font-medium px-2 py-0.5 rounded-md transition-colors",
              path === "/sites/new"
                ? "bg-primary text-white"
                : "bg-[#F1F5F9] text-t2 hover:bg-primary hover:text-white",
            )}
          >
            + New
          </Link>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sites…"
          className="border border-border rounded-md px-2.5 py-1.5 text-ui-sm text-t1 bg-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-t3"
        />
        <div className="flex items-center gap-1 text-ui-xs">
          <span className="text-t3 font-semibold uppercase tracking-wider mr-1">
            Sort
          </span>
          <SortToggle
            value={sort}
            on="recent"
            label="Recent"
            onChange={setSort}
          />
          <SortToggle value={sort} on="name" label="Name" onChange={setSort} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="px-3 py-6 text-ui-md text-t3">Loading…</p>}
        {!isLoading && (sites?.length ?? 0) === 0 && (
          <EmptyState
            title="No sites yet."
            hint="Create your first site."
            action={
              <Link
                to="/sites/new"
                className="text-ui-sm font-medium bg-primary text-white px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
              >
                + New site
              </Link>
            }
          />
        )}
        {!isLoading && (sites?.length ?? 0) > 0 && filtered.length === 0 && (
          <p className="px-3 py-6 text-ui-sm text-t3 text-center">
            No sites match.
          </p>
        )}
        {filtered.map((vm) => (
          <SiteCard key={vm.id} vm={vm} selected={path === `/sites/${vm.id}`} />
        ))}
      </div>
    </aside>
  );
}

function SortToggle({
  value,
  on,
  label,
  onChange,
}: {
  value: SortKey;
  on: SortKey;
  label: string;
  onChange: (s: SortKey) => void;
}) {
  const selected = value === on;
  return (
    <button
      type="button"
      onClick={() => onChange(on)}
      className={cn(
        "px-2 py-0.5 rounded font-medium transition-colors",
        selected
          ? "bg-t1 text-white"
          : "bg-white text-t2 border border-border hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
