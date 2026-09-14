import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useMissions } from "@/api/missions";
import { useMissionStates } from "@/ws/missionState";
import { FilterChips, type ChipItem } from "@/components/ui/FilterChips";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  bucketOf,
  countByBucket,
  liveFor,
  type MissionLifecycleBucket,
} from "../adapters";
import { MissionGroupHeader } from "./MissionGroupHeader";
import { MissionCard } from "./MissionCard";

type FilterKey = "all" | MissionLifecycleBucket;

interface BucketDef {
  bucket: MissionLifecycleBucket;
  label: string;
  dotColor: string;
}

const BUCKETS: BucketDef[] = [
  { bucket: "running", label: "Running now", dotColor: "bg-[#16A34A]" },
  { bucket: "assigned", label: "Assigned", dotColor: "bg-[#3B82F6]" },
  { bucket: "draft", label: "Drafts", dotColor: "bg-[#94A3B8]" },
  { bucket: "history", label: "History", dotColor: "bg-[#94A3B8]" },
];

export function MissionsSidebar() {
  const { data: missions, isLoading } = useMissions();
  const liveStates = useMissionStates();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => countByBucket(missions ?? []), [missions]);

  const chipItems: ChipItem<FilterKey>[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "running", label: "Active", count: counts.running },
    { key: "assigned", label: "Assigned", count: counts.assigned },
    { key: "draft", label: "Drafts", count: counts.draft },
    { key: "history", label: "History", count: counts.history },
  ];

  const filtered = useMemo(() => {
    if (!missions) return [];
    const q = query.trim().toLowerCase();
    return missions.filter((m) => {
      if (filter !== "all" && bucketOf(m) !== filter) return false;
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [missions, filter, query]);

  const grouped = useMemo(() => {
    const groups = new Map<MissionLifecycleBucket, typeof filtered>();
    for (const b of BUCKETS) groups.set(b.bucket, []);
    for (const m of filtered) {
      groups.get(bucketOf(m))!.push(m);
    }
    // Within each group, newest-updated first.
    for (const [, list] of groups) {
      list.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    }
    return groups;
  }, [filtered]);

  return (
    <aside className="h-full bg-white border-r border-border flex flex-col">
      <div className="px-3 pt-3 pb-2 border-b border-border flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-ui-sm uppercase tracking-wider text-t3 font-semibold">
            Missions ({missions?.length ?? 0})
          </span>
          <Link
            to="/missions/new"
            className={`text-ui-xs font-medium px-2 py-0.5 rounded-md transition-colors ${
              path === "/missions/new"
                ? "bg-primary text-white"
                : "bg-[#F1F5F9] text-t2 hover:bg-primary hover:text-white"
            }`}
          >
            + New
          </Link>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search missions…"
          className="border border-border rounded-md px-2.5 py-1.5 text-ui-sm text-t1 bg-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-t3"
        />
        <FilterChips items={chipItems} value={filter} onChange={setFilter} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="px-3 py-6 text-ui-md text-t3">Loading…</p>}
        {!isLoading && (missions?.length ?? 0) === 0 && (
          <EmptyState
            title="No missions yet."
            hint="Create your first mission."
            action={
              <Link
                to="/missions/new"
                className="text-ui-sm font-medium bg-primary text-white px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
              >
                + New mission
              </Link>
            }
          />
        )}
        {!isLoading && (missions?.length ?? 0) > 0 && filtered.length === 0 && (
          <p className="px-3 py-6 text-ui-sm text-t3 text-center">
            No missions match.
          </p>
        )}
        {BUCKETS.map((b) => {
          const list = grouped.get(b.bucket) ?? [];
          if (!list.length) return null;
          return (
            <div key={b.bucket}>
              <MissionGroupHeader
                label={b.label}
                count={list.length}
                dotColor={b.dotColor}
              />
              {list.map((m) => (
                <MissionCard
                  key={m.mission_id}
                  mission={m}
                  selected={path === `/missions/${m.mission_id}`}
                  live={liveFor(liveStates, m)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
