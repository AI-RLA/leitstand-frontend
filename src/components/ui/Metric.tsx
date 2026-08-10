import { cn } from "@/lib/utils";

type MetricAccent = "default" | "primary" | "amber" | "red";

interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  accent?: MetricAccent;
  className?: string;
}

const ACCENT_CLASSES: Record<MetricAccent, string> = {
  default: "text-t1",
  primary: "text-[#15803D]",
  amber: "text-[#B45309]",
  red: "text-[#B91C1C]",
};

export function Metric({
  label,
  value,
  sub,
  accent = "default",
  className,
}: MetricProps) {
  return (
    <div className={cn("min-w-0 flex flex-col gap-1", className)}>
      <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold whitespace-nowrap">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={cn(
            "text-ui-2xl font-bold tabular-nums leading-none",
            ACCENT_CLASSES[accent],
          )}
        >
          {value}
        </span>
        {sub && (
          <span className="text-ui-xs text-t3 font-mono truncate">{sub}</span>
        )}
      </div>
    </div>
  );
}
