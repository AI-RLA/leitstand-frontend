import { useRef, useState, useCallback } from "react";
import { Sidebar } from "@/features/fleet/Sidebar";
import { RightRail } from "@/features/fleet/RightRail";
import { FleetMap } from "@/features/fleet/Map";

function useDragResize(
  initial: number,
  min: number,
  max: number,
  dir: "ltr" | "rtl",
) {
  const [width, setWidth] = useState(initial);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      startW.current = width;
      setIsDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (e: MouseEvent) => {
        const delta =
          dir === "ltr"
            ? e.clientX - startX.current
            : startX.current - e.clientX;
        setWidth(Math.max(min, Math.min(max, startW.current + delta)));
      };
      const onUp = () => {
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width, min, max, dir],
  );

  return { width, isDragging, onMouseDown };
}

export default function App() {
  const sidebar = useDragResize(280, 160, 400, "ltr");
  const rightRail = useDragResize(320, 200, 480, "rtl");
  const isDragging = sidebar.isDragging || rightRail.isDragging;

  return (
    <div className="h-full flex overflow-hidden">
      <div
        style={{ width: sidebar.width }}
        className="relative shrink-0 flex flex-col"
      >
        <Sidebar />
        <div
          className="absolute right-0 inset-y-0 w-1 z-10 cursor-col-resize hover:bg-primary transition-colors duration-150"
          onMouseDown={sidebar.onMouseDown}
        />
      </div>
      <div
        className="flex-1 relative overflow-hidden"
        style={isDragging ? { pointerEvents: "none" } : undefined}
      >
        <FleetMap />
      </div>
      <div
        style={{ width: rightRail.width }}
        className="relative shrink-0 flex flex-col"
      >
        <RightRail />
        <div
          className="absolute left-0 inset-y-0 w-1 z-10 cursor-col-resize hover:bg-primary transition-colors duration-150"
          onMouseDown={rightRail.onMouseDown}
        />
      </div>
    </div>
  );
}
