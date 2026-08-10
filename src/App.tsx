import { useState } from "react";
import { Sidebar } from "@/features/fleet/Sidebar";
import { RightRail } from "@/features/fleet/RightRail";
import { FleetMap } from "@/features/fleet/Map";
import { ResizablePane } from "@/components/ui/ResizablePane";

export default function App() {
  const [leftDragging, setLeftDragging] = useState(false);
  const [rightDragging, setRightDragging] = useState(false);
  const isDragging = leftDragging || rightDragging;

  return (
    <div className="h-full flex overflow-hidden">
      <ResizablePane
        paneId="fleet-list"
        side="left"
        initial={280}
        min={160}
        max={400}
        onDragStateChange={setLeftDragging}
      >
        <Sidebar />
      </ResizablePane>
      <div
        className="flex-1 relative overflow-hidden"
        style={isDragging ? { pointerEvents: "none" } : undefined}
      >
        <FleetMap />
      </div>
      <ResizablePane
        paneId="fleet-rail"
        side="right"
        initial={320}
        min={200}
        max={480}
        onDragStateChange={setRightDragging}
      >
        <RightRail />
      </ResizablePane>
    </div>
  );
}
