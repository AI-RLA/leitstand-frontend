import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // Render the value in the monospace face — used for coordinate / ref fields.
  mono?: boolean;
}

export function Input({ mono, className, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        "border border-border rounded-md px-3 py-2 text-ui-md text-t1 bg-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-t3",
        mono && "font-mono",
        className,
      )}
      {...rest}
    />
  );
}
