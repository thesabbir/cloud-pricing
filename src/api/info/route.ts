import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import type { Env } from "../../types/env";
import { infoResponseSchema } from "../schemas";

const infoRouter = new Hono<{ Bindings: Env }>();

infoRouter.get(
  "/",
  describeRoute({
    tags: ["Info"],
    summary: "Get API information",
    description: "Returns information about the API and supported providers",
    responses: {
      200: {
        description: "API information",
        content: {
          "application/json": {
            schema: resolver(infoResponseSchema),
          },
        },
      },
    },
  }),
  (c) => {
    return c.json({
      supportedProviders: ["aws", "azure", "gcp", "oracle", "ibm", "vercel"],
    });
  }
);

export default infoRouter;