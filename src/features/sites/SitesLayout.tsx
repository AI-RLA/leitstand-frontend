import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ResizablePane } from "@/components/ui/ResizablePane";
import { EmptyState } from "@/components/ui/EmptyState";
import { SitesSidebar } from "./components/SitesSidebar";

export function SitesLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const atIndex = path === "/sites" || path === "/sites/";

  return (
    <div className="h-full flex overflow-hidden">
      <ResizablePane
        paneId="sites-list"
        side="left"
        initial={240}
        min={200}
        max={420}
      >
        <SitesSidebar />
      </ResizablePane>
      <div className="flex-1 overflow-y-auto bg-canvas">
        {atIndex ? (
          <EmptyState
            className="mt-16"
            title="No site selected"
            hint="Pick one from the sidebar, or create a new site."
            action={
              <Link
                to="/sites/new"
                className="text-ui-sm font-medium bg-primary text-white px-3.5 py-1.5 rounded-md hover:opacity-90 transition-opacity"
              >
                + New site
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
