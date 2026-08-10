import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: string[];
  activeIndex: number;
  completedIndices?: number[];
  onSelect?: (index: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  activeIndex,
  completedIndices = [],
  onSelect,
  className,
}: StepIndicatorProps) {
  const completed = new Set(completedIndices);
  return (
    <ol className={cn("flex items-center gap-1", className)}>
      {steps.map((label, i) => {
        const done = completed.has(i);
        const active = i === activeIndex;
        const clickable = !!onSelect;
        return (
          <li
            key={i}
            className={cn(
              "flex items-center gap-1.5 min-w-0",
              i < steps.length - 1 && "flex-1",
            )}
          >
            <button
              type="button"
              onClick={clickable ? () => onSelect(i) : undefined}
              disabled={!clickable}
              className={cn(
                "inline-flex items-center gap-1.5 text-ui-xs font-medium transition-colors",
                clickable && "hover:text-t1 cursor-pointer",
                !clickable && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-ui-xs font-bold font-mono shrink-0 border-[1.5px] transition-colors",
                  done && "bg-primary border-primary text-white",
                  !done && active && "bg-white border-primary text-primary",
                  !done && !active && "bg-white border-border text-t3",
                )}
              >
                {done ? (
                  <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "truncate",
                  done || active ? "text-t1 font-semibold" : "text-t3",
                )}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={cn("flex-1 h-px", done ? "bg-primary" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
