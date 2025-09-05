import { Hono } from "hono";
import { cors } from "hono/cors";
import { openAPIRouteHandler } from "hono-openapi";
import infoRouter from "./info/route";
import providersRouter from "./providers/route";
import testRouter from "./providers/test-scrape";
import type { Env } from "../types/env";
import { Scalar } from "@scalar/hono-api-reference";

const apiRouter = new Hono<{ Bindings: Env }>();

apiRouter.use(
  cors({
    origin: ["*"],
    allowMethods: ["*"],
    allowHeaders: ["*"],
    exposeHeaders: ["*"],
    credentials: true,
  })
);

// Mount routers
apiRouter.route("/info", infoRouter);
apiRouter.route("/providers", providersRouter);
apiRouter.route("/test", testRouter);

// Generate OpenAPI spec from routes dynamically
apiRouter.get(
  "/openapi.json",
  openAPIRouteHandler(apiRouter, {
    documentation: {
      info: {
        title: "Cloud Pricing API",
        version: "1.0.0",
        description:
          "API for aggregating and serving cloud provider pricing data using LLM-powered extraction",
        contact: {
          name: "Cloud Pricing API Support",
        },
      },
      servers: [
        {
          url: "/api",
          description: "API Server",
        },
      ],
      tags: [
        {
          name: "Info",
          description: "API information endpoints",
        },
        {
          name: "Providers",
          description: "Cloud provider pricing endpoints",
        },
      ],
    },
  })
);

// Serve Scalar documentation UI
apiRouter.get(
  "/docs",
  Scalar({
    sources: [
      {
        title: "Cloud Pricing API",
        url: "/api/openapi.json",
      },
    ],
    theme: "purple",
    layout: "modern",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
  })
);

export default apiRouter;
