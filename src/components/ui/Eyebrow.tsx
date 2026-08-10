import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "text-ui-xs uppercase tracking-wider text-t3 font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}
