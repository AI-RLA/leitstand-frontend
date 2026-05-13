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
    <div className="flex items-center justify-center h-full text-[13px] text-t3">
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  fieldsRoute.addChildren([
    fieldIndexRoute,
    fieldNewRoute,
    fieldDetailRoute,
    fieldEditRoute,
  ]),
]);
const router = createRouter({ routeTree });
const queryClient = new QueryClient();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
