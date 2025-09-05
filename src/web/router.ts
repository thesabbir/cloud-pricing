import { Hono } from "hono";
import { renderer } from "./renderer";

const app = new Hono();

app.use(renderer);

import HomePage from "./home/page";

app.get("/", HomePage);

export default app;
