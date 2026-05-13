import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useFields } from "@/api/fields";
import { FieldsMap } from "./FieldsMap";

export function FieldsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isDrawing = path === "/fields/new" || path.endsWith("/edit");

  // Extract selected field ID from path, e.g. /fields/<uuid>
  const fieldIdMatch = path.match(/^\/fields\/([^/]+)$/);
  const selectedFieldId =
    fieldIdMatch && fieldIdMatch[1] !== "new" ? fieldIdMatch[1] : null;

  if (isDrawing) {
    return (
      <div className="h-full overflow-hidden">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      <FieldSidebar />
      <div className="flex-1 flex overflow-hidden">
        {/* Map panel */}
        <div className="relative flex-1 min-w-0">
          <FieldsMap selectedFieldId={selectedFieldId} />
        </div>
        {/* Detail / empty-state panel */}
        <div className="w-[380px] shrink-0 overflow-y-auto bg-[#F8FAFC] border-l border-border">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function FieldSidebar() {
  const { data: fields, isLoading } = useFields();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="w-[220px] bg-white border-r border-border flex flex-col">
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
                  : "border-transparent hover:bg-[#F8FAFC]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-ui-md font-semibold text-t1 truncate">
                  {f.name}
                </span>
                <span className="text-ui-xs text-t3 tabular-nums shrink-0">
                  {f.area_ha.toFixed(1)} ha
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
