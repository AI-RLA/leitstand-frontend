import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ResizablePane } from "@/components/ui/ResizablePane";
import { EmptyState } from "@/components/ui/EmptyState";
import { MissionsSidebar } from "./components/MissionsSidebar";

export function MissionsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const atIndex = path === "/missions" || path === "/missions/";

  return (
    <div className="h-full flex overflow-hidden">
      <ResizablePane
        paneId="missions-list"
        side="left"
        initial={280}
        min={200}
        max={420}
      >
        <MissionsSidebar />
      </ResizablePane>
      {/* Size reference for the routes inside; a page cannot query its own width. */}
      <div className="flex-1 overflow-y-auto bg-canvas [container-type:inline-size]">
        {atIndex ? (
          <EmptyState
            className="mt-16"
            title="No mission selected"
            hint="Pick one from the sidebar, or create a new mission."
            action={
              <Link
                to="/missions/new"
                className="text-ui-sm font-medium bg-primary text-white px-3.5 py-1.5 rounded-md hover:opacity-90 transition-opacity"
              >
                + New mission
              </Link>
            }
          />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
