import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { seed } from "./seed.js";
import { DB_PATH } from "./db.js";

seed();
const app = createApp();
const port = Number(process.env.PORT || 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Rotation Engine API listening on http://localhost:${info.port}`);
  console.log(`SQLite: ${DB_PATH}`);
});
