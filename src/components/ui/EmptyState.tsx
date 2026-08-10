import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  hint,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "px-6 py-12 flex flex-col items-center text-center gap-2",
        className,
      )}
    >
      <p className="text-ui-md text-t2 font-medium">{title}</p>
      {hint && <p className="text-ui-sm text-t3">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
