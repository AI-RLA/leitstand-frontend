import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useFields } from "@/api/fields";
import { ResizablePane } from "@/components/ui/ResizablePane";
import { FieldsMap } from "./FieldsMap";

export function FieldsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isDrawing = path === "/fields/new" || path.endsWith("/edit");

  const fieldIdMatch = path.match(/^\/fields\/([^/]+)$/);
  const selectedFieldId =
    fieldIdMatch && fieldIdMatch[1] !== "new" ? fieldIdMatch[1] : null;

  const [leftDragging, setLeftDragging] = useState(false);
  const [rightDragging, setRightDragging] = useState(false);
  const isDragging = leftDragging || rightDragging;

  if (isDrawing) {
    return (
      <div className="h-full overflow-hidden">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      <ResizablePane
        paneId="fields-list"
        side="left"
        initial={220}
        min={180}
        max={360}
        onDragStateChange={setLeftDragging}
      >
        <FieldSidebar />
      </ResizablePane>
      <div className="flex-1 flex overflow-hidden">
        <div
          className="relative flex-1 min-w-0"
          style={isDragging ? { pointerEvents: "none" } : undefined}
        >
          <FieldsMap selectedFieldId={selectedFieldId} />
        </div>
        <ResizablePane
          paneId="fields-detail"
          side="right"
          initial={380}
          min={280}
          max={520}
          onDragStateChange={setRightDragging}
        >
          <div className="h-full overflow-y-auto bg-canvas border-l border-border">
            <Outlet />
          </div>
        </ResizablePane>
      </div>
    </div>
  );
}

function FieldSidebar() {
  const { data: fields, isLoading } = useFields();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="h-full bg-white border-r border-border flex flex-col">
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <span className="text-ui-sm uppercase tracking-wider text-t3 font-semibold">
          Fields ({fields?.length ?? 0})
        </span>
        <Link
          to="/fields/new"
          className={`text-ui-xs font-medium px-2 py-0.5 rounded-md transition-colors ${
            path === "/fields/new"
              ? "bg-primary text-white"
              : "bg-[#F1F5F9] text-t2 hover:bg-primary hover:text-white"
          }`}
        >
          + New
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="px-3 py-6 text-ui-md text-t3">Loading…</p>}
        {!isLoading && !fields?.length && (
          <p className="px-3 py-6 text-ui-md text-t3">No fields yet.</p>
        )}
        {fields?.map((f) => {
          const selected = path === `/fields/${f.id}`;
          return (
            <Link
              key={f.id}
              to="/fields/$id"
              params={{ id: f.id }}
              className={`block w-full py-[9px] px-3 border-l-[3px] transition-colors ${
                selected
                  ? "bg-[#F0FDF4] border-primary"
                  : "border-transparent hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-ui-md font-semibold text-t1 truncate">
                  {f.name}
                </span>
                <span className="text-ui-xs text-t3 tabular-nums shrink-0">
                  {(f.area_ha ?? 0).toFixed(1)} ha
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
