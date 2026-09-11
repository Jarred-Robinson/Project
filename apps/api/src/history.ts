import type { Hono } from "hono";
import { historyToWorkbook, listCatalog, listShifts, shiftToWorkbook, getShift } from "@rotation/db";
import type { AppEnv } from "./auth.js";
import { requireAuth } from "./auth.js";

function xlsx(buf: Buffer, filename: string) {
  return new Response(Uint8Array.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function registerHistoryRoutes(app: Hono<AppEnv>) {
  app.get("/api/export/shift/:id", requireAuth, (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Not found" }, 404);
    const shift = getShift(id);
    if (!shift) return c.json({ error: "Not found" }, 404);
    return xlsx(shiftToWorkbook(shift, listCatalog()), `ED-Board-${shift.date}-${shift.side}.xlsx`);
  });

  app.get("/api/export/history", requireAuth, (c) => {
    const today = new Date().toISOString().slice(0, 10);
    return xlsx(historyToWorkbook(listShifts(), listCatalog()), `ED-Full-History-${today}.xlsx`);
  });
}
