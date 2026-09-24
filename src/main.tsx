import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import App from "./App";
import { RootLayout } from "./RootLayout";
import { FieldsLayout } from "./features/fields/FieldsLayout";
import { FieldDraw } from "./features/fields/FieldDraw";
import { FieldEdit } from "./features/fields/FieldEdit";
import { FieldDetail } from "./features/fields/FieldDetail";
import { MissionsLayout } from "./features/missions/MissionsLayout";
import { MissionDetail } from "./features/missions/MissionDetail";
import { MissionEdit } from "./features/missions/MissionEdit";
import { RunDetail } from "./features/missions/RunDetail";
import { MissionNew } from "./features/missions/MissionNew";
import { SitesLayout } from "./features/sites/SitesLayout";
import { SiteDetail } from "./features/sites/SiteDetail";
import { SiteNew } from "./features/sites/SiteNew";
import { mapConfigReady } from "./config/mapConfig";
import "./index.css";

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: App,
});

const fieldsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/fields",
  component: FieldsLayout,
});

const fieldIndexRoute = createRoute({
  getParentRoute: () => fieldsRoute,
  path: "/",
  component: () => (
    <div className="flex items-center justify-center h-full text-ui-md text-t3">
      Select a field or create one.
    </div>
  ),
});

const fieldNewRoute = createRoute({
  getParentRoute: () => fieldsRoute,
  path: "/new",
  component: FieldDraw,
});

const fieldDetailRoute = createRoute({
  getParentRoute: () => fieldsRoute,
  path: "/$id",
  component: () => {
    const { id } = fieldDetailRoute.useParams();
    return <FieldDetail id={id} />;
  },
});

const fieldEditRoute = createRoute({
  getParentRoute: () => fieldsRoute,
  path: "/$id/edit",
  component: () => {
    const { id } = fieldEditRoute.useParams();
    return <FieldEdit id={id} />;
  },
});

const missionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/missions",
  component: MissionsLayout,
});

const missionIndexRoute = createRoute({
  getParentRoute: () => missionsRoute,
  path: "/",
  component: () => (
    <div className="flex items-center justify-center h-full text-ui-md text-t3">
      Select a mission or create one.
    </div>
  ),
});

const missionNewRoute = createRoute({
  getParentRoute: () => missionsRoute,
  path: "/new",
  component: MissionNew,
});

const missionDetailRoute = createRoute({
  getParentRoute: () => missionsRoute,
  path: "/$id",
  component: () => {
    const { id } = missionDetailRoute.useParams();
    return <MissionDetail id={id} />;
  },
});

const missionEditRoute = createRoute({
  getParentRoute: () => missionsRoute,
  path: "/$id/edit",
  component: () => {
    const { id } = missionEditRoute.useParams();
    return <MissionEdit id={id} />;
  },
});

// Nested under the mission for the breadcrumb, although the API addresses a run by its own id.
const missionRunRoute = createRoute({
  getParentRoute: () => missionsRoute,
  path: "/$id/runs/$runId",
  component: () => {
    const { id, runId } = missionRunRoute.useParams();
    return <RunDetail missionId={id} runId={runId} />;
  },
});

const sitesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites",
  component: SitesLayout,
});

const siteIndexRoute = createRoute({
  getParentRoute: () => sitesRoute,
  path: "/",
  component: () => (
    <div className="flex items-center justify-center h-full text-ui-md text-t3">
      Select a site or create one.
    </div>
  ),
});

const siteNewRoute = createRoute({
  getParentRoute: () => sitesRoute,
  path: "/new",
  component: SiteNew,
});

const siteDetailRoute = createRoute({
  getParentRoute: () => sitesRoute,
  path: "/$id",
  component: () => {
    const { id } = siteDetailRoute.useParams();
    return <SiteDetail id={id} />;
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  fieldsRoute.addChildren([
    fieldIndexRoute,
    fieldNewRoute,
    fieldDetailRoute,
    fieldEditRoute,
  ]),
  missionsRoute.addChildren([
    missionIndexRoute,
    missionNewRoute,
    missionDetailRoute,
    missionEditRoute,
    missionRunRoute,
  ]),
  sitesRoute.addChildren([siteIndexRoute, siteNewRoute, siteDetailRoute]),
]);
const router = createRouter({
  routeTree,
  // Route-level error boundary: a render error in a route subtree shows this
  // instead of white-screening the whole app.
  defaultErrorComponent: ({ error }) => (
    <div className="p-6">
      <p className="text-ui-sm font-semibold text-t1 mb-1">
        Something went wrong.
      </p>
      <p className="text-ui-sm text-t3">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  ),
});
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fleet data is WS-driven; avoid refetch storms and noisy focus refetches.
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Maps build their basemap layers synchronously at mount, so the map config must be loaded first.
await mapConfigReady;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
