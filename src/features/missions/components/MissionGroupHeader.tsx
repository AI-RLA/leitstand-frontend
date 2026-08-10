import { cn } from "@/lib/utils";

interface MissionGroupHeaderProps {
  label: string;
  count: number;
  dotColor: string;
}

export function MissionGroupHeader({
  label,
  count,
  dotColor,
}: MissionGroupHeaderProps) {
  return (
    <div className="px-3 py-1.5 bg-[#FAFBFC] border-b border-border flex items-center gap-1.5">
      <span
        className={cn("inline-block w-[5px] h-[5px] rounded-full", dotColor)}
      />
      <span className="text-ui-xs font-semibold text-t3 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-ui-xs text-t2 font-bold tabular-nums">{count}</span>
    </div>
  );
}
