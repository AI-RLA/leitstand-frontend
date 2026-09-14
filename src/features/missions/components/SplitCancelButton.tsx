import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  confirming: boolean;
  pending: boolean;
  /** The run is already CANCELLING: the button re-sends instead of asking twice. */
  resend?: boolean;
  onCancel: (mode: "immediate" | "graceful") => void;
  size?: "sm" | "xs";
};

/** Cancel stops the robot at once; the arrow offers the gentle stop at the next safe point. */
export function SplitCancelButton({
  confirming,
  pending,
  resend = false,
  onCancel,
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pad =
    size === "xs" ? "text-ui-xs px-2 py-0.5" : "text-ui-sm px-3 py-1.5";
  const main = confirming
    ? "text-white bg-red-500 border-red-500 hover:bg-red-600"
    : "text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300";
  const label = pending
    ? "Cancelling…"
    : confirming
      ? "Confirm cancel?"
      : resend
        ? "Send cancel again"
        : "Cancel run";

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        disabled={pending}
        onClick={() => onCancel("immediate")}
        className={cn(
          "border rounded-l-md disabled:opacity-50 transition-colors",
          pad,
          main,
        )}
        title="Stops the robot at once, then runs the stage's cleanup."
      >
        {label}
      </button>
      <button
        type="button"
        disabled={pending}
        aria-label="More ways to cancel"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "border border-l-0 rounded-r-md px-1.5 disabled:opacity-50 transition-colors",
          main,
        )}
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-border rounded-md shadow-sm min-w-[12rem]">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCancel("graceful");
            }}
            className="w-full text-left text-ui-sm px-3 py-2 hover:bg-[#F1F5F9]"
            title="Finishes the current move to a safe point first, within seconds."
          >
            Cancel gently
          </button>
        </div>
      )}
    </div>
  );
}
