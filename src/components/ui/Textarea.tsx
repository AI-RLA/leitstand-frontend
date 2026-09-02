import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "border border-border rounded-md px-3 py-2 text-ui-md text-t1 bg-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition placeholder:text-t3",
        className,
      )}
      {...rest}
    />
  );
}
