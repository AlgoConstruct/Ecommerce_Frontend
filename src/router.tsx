import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data dehydrated from the SSR pass is fresh as of the render, not
        // stale — without this, every query refetches the instant the page
        // hydrates on the client, doubling the request count for no reason.
        staleTime: 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    // __root.tsx already wraps the tree in its own QueryClientProvider using
    // the same queryClient from router context, so skip the integration's
    // duplicate Wrap-based provider.
    wrapQueryClient: false,
  });

  return router;
};
