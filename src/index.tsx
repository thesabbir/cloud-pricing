import { Hono } from "hono";
import apiRouter from "./api/router";
import webRouter from "./web/router";

const app = new Hono();

app.get("/health", (c) => c.json({ message: "OK" }));

app.route("/api", apiRouter);
app.route("/", webRouter);

export default app;
