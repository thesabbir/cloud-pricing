import { Hono } from "hono";

const infoRouter = new Hono();

infoRouter.get("/", (c) =>
  c.json({
    supportedProviders: ["aws", "azure", "gcp", "oracle", "ibm"],
  })
);

export default infoRouter;
