import { Hono } from "hono";
import { cors } from "hono/cors";
import infoRouter from "./info/route";

const apiRouter = new Hono();

apiRouter.use(
  cors({
    origin: ["*"],
    allowMethods: ["*"],
    allowHeaders: ["*"],
    exposeHeaders: ["*"],
    credentials: true,
  })
);

apiRouter.route("/info", infoRouter);

export default apiRouter;
