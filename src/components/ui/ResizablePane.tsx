import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { loadPaneSize, savePaneSize } from "@/stores/paneSizes";

interface ResizablePaneProps {
  paneId: string;
  side: "left" | "right";
  initial: number;
  min: number;
  max: number;
  children: ReactNode;
  className?: string;
  onDragStateChange?: (dragging: boolean) => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function ResizablePane({
  paneId,
  side,
  initial,
  min,
  max,
  children,
  className,
  onDragStateChange,
}: ResizablePaneProps) {
  const [width, setWidth] = useState(() =>
    clamp(loadPaneSize(paneId, initial), min, max),
  );
  // Mirror of width that's safe to read inside the drag end handler without
  // racing React's state flush. Stays in sync because onMove writes both.
  const widthRef = useRef(width);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    onDragStateChange?.(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: globalThis.PointerEvent) {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      const next = clamp(startW + delta, min, max);
      widthRef.current = next;
      setWidth(next);
    }
    function onUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      onDragStateChange?.(false);
      savePaneSize(paneId, widthRef.current);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  return (
    <div
      style={{ width }}
      className={cn("relative shrink-0 flex flex-col h-full", className)}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize pane"
        className={cn(
          "absolute inset-y-0 w-1 z-10 cursor-col-resize hover:bg-primary transition-colors duration-150",
          side === "left" ? "right-0" : "left-0",
        )}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
}
