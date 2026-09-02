import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/relativeTime";
import type { SiteViewModel } from "../adapters";

interface SiteCardProps {
  vm: SiteViewModel;
  selected: boolean;
}

export function SiteCard({ vm, selected }: SiteCardProps) {
  const inUse = vm.usageCount > 0;
  return (
    <Link
      to="/sites/$id"
      params={{ id: vm.id }}
      className={cn(
        "block w-full px-3 py-[10px] border-l-[3px] border-b border-border transition-colors",
        selected
          ? "bg-[#EFF6FF] border-l-primary"
          : "border-l-transparent hover:bg-muted",
      )}
    >
      <div className="flex items-center gap-2">
        <MapPin
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            inUse ? "text-primary fill-primary/30" : "text-t3",
          )}
        />
        <span className="text-ui-md font-semibold text-t1 flex-1 truncate">
          {vm.name}
        </span>
      </div>
      <p className="ml-[22px] mt-0.5 text-ui-xs text-t3 font-mono truncate">
        {vm.nav2MapRef}
      </p>
      <p className="ml-[22px] text-ui-xs text-t3 font-mono">
        {vm.anchorLat.toFixed(5)}, {vm.anchorLon.toFixed(5)}
        {inUse && (
          <>
            <span className="mx-1">·</span>
            {vm.usageCount} mission{vm.usageCount === 1 ? "" : "s"}
          </>
        )}
      </p>
      {inUse && vm.lastUsedAt && (
        <p className="ml-[22px] text-ui-xs text-t3">
          last used {relativeTime(vm.lastUsedAt)}
        </p>
      )}
    </Link>
  );
}
