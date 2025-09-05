import { Hono } from "hono";
import apiRouter from "./api/router";
import webRouter from "./web/router";
import { Env } from "./types/env";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ message: "OK", environment: c.env.ENVIRONMENT || "development" }));

app.route("/api", apiRouter);
app.route("/", webRouter);

export default app;
