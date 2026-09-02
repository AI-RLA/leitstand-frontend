import { useState } from "react";
import { Sidebar } from "@/features/fleet/Sidebar";
import { FleetMap } from "@/features/fleet/Map";
import { ResizablePane } from "@/components/ui/ResizablePane";

export default function App() {
  const [leftDragging, setLeftDragging] = useState(false);
  const isDragging = leftDragging;

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
    </div>
  );
}
