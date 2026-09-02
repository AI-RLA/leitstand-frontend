import { cn } from "@/lib/utils";

export interface ChipItem<K extends string> {
  key: K;
  label: string;
  count: number;
}

interface FilterChipsProps<K extends string> {
  items: ChipItem<K>[];
  value: K;
  onChange: (k: K) => void;
  className?: string;
}

export function FilterChips<K extends string>({
  items,
  value,
  onChange,
  className,
}: FilterChipsProps<K>) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {items.map((it) => {
        const selected = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cn(
              "inline-flex items-center gap-1.5 text-ui-xs font-medium px-2 py-0.5 rounded-full border transition-colors",
              selected
                ? "bg-t1 text-white border-t1"
                : "bg-white text-t2 border-border hover:bg-muted",
            )}
          >
            {it.label}
            <span
              className={cn(
                "text-ui-xs font-semibold tabular-nums",
                selected ? "text-white/70" : "text-t3",
              )}
            >
              {it.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
