import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GatewayClient } from "./gateway.js";
import { statusRouter } from "./routes/status.js";
import { chatRouter } from "./routes/chat.js";
import { sessionsRouter } from "./routes/sessions.js";
import { cronRouter } from "./routes/cron.js";
import { systemRouter } from "./routes/system.js";

const port = parseInt(process.env.MC_PORT ?? "3333", 10);
const gatewayPort = process.env.GATEWAY_PORT ?? "18789";
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";

if (!gatewayToken) {
  console.warn("[mission-control] WARNING: OPENCLAW_GATEWAY_TOKEN not set — gateway calls will fail");
}

const gateway = new GatewayClient(
  `http://127.0.0.1:${gatewayPort}`,
  gatewayToken,
);

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/status", statusRouter(gateway));
app.use("/api/chat", chatRouter(gateway));
app.use("/api/sessions", sessionsRouter(gateway));
app.use("/api/cron", cronRouter(gateway));
app.use("/api/system", systemRouter(gateway));

// Static files (frontend build output)
const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDir));

// SPA fallback — serve index.html for all non-API routes
app.get("*", (_req, res) => {
  res.sendFile(join(frontendDir, "index.html"));
});

app.listen(port, () => {
  console.log(`[mission-control] Listening on http://127.0.0.1:${port}`);
  console.log(`[mission-control] Gateway: http://127.0.0.1:${gatewayPort}`);
});
